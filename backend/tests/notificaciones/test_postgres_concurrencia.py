"""Atomicidad y concurrencia reales sobre PostgreSQL descartable.

Estas pruebas necesitan una base local `esseri_test` provista por el entorno; sin
`ESSERI_DISPOSABLE_POSTGRES_URL` se saltean para no presentar SQLite como prueba de locking.
Cada prueba crea un esquema temporal propio y lo elimina al terminar.
"""

import os
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import date

import pytest
from sqlalchemy import create_engine, event, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy.schema import CreateSchema, DropSchema

from src.academico import service as academico_service
from src.academico.models import Anio, Division, MotivoJustificacion, NivelEducativo
from src.academico.schemas import AsistenciaCreate
from src.auth import sesion_service
from src.auth.models import Rol, Usuario, UsuarioRol
from src.familias_alumnos.models import Alumno, Familia, FamiliaAlumno
from src.inscripciones.models import Asistencia, Inscripcion
from src.models import Base, Persona
from src.notificaciones import service as notificaciones_service
from src.notificaciones.academico_service import registrar_ausencia
from src.notificaciones.constants import TIPO_INASISTENCIA_REGISTRADA
from src.notificaciones.exceptions import NotificacionNoEncontrada
from src.notificaciones.models import NotificacionInterna
from src.workflows.models import CampoEvento, TipoEvento

PASSWORD_VALIDA = "una-contrasenia-larga"


def _url() -> str:
    url = os.environ.get("ESSERI_DISPOSABLE_POSTGRES_URL")
    if not url:
        pytest.skip("requires a disposable PostgreSQL test database")
    parsed = make_url(url)
    if (
        parsed.get_backend_name() != "postgresql"
        or parsed.host != "127.0.0.1"
        or parsed.database != "esseri_test"
    ):
        pytest.fail("refusing to use a database other than the disposable local esseri_test")
    return url


def _cargar_escenario(engine) -> dict[str, uuid.UUID]:
    ids = {clave: uuid.uuid4() for clave in ("rol", "usuario", "persona", "familia", "alumno")}
    with Session(engine) as db:
        rol = Rol(nombre="familia")
        persona = Persona(nombre="Ana", apellido="Ríos", dni=str(ids["persona"]))
        alumno_persona = Persona(nombre="Tiziano", apellido="Ríos", dni=str(uuid.uuid4()))
        db.add_all([rol, persona, alumno_persona])
        db.flush()

        familia = Familia(persona_id=persona.id)
        alumno = Alumno(numero_legajo="A-2027-950", estado="activo", persona_id=alumno_persona.id)
        usuario = Usuario(
            email=f"{ids['usuario']}@example.test",
            password_hash=sesion_service.hashear_password(PASSWORD_VALIDA),
            auth_provider="local",
            estado="activo",
            persona_id=persona.id,
        )
        nivel = NivelEducativo(nombre="Primario")
        db.add_all([familia, alumno, usuario, nivel])
        db.flush()

        anio = Anio(numero=4, nivel_educativo_id=nivel.id)
        db.add(anio)
        db.flush()
        division = Division(nombre="4° B", anio_id=anio.id)
        db.add(division)
        db.flush()
        inscripcion = Inscripcion(
            ciclo_lectivo="2027",
            fecha_inscripcion=date(2026, 10, 29),
            tipo="nueva",
            estado="activa",
            alumno_id=alumno.id,
            division_id=division.id,
        )
        db.add(inscripcion)
        db.add(
            FamiliaAlumno(familia_id=familia.id, alumno_id=alumno.id, recibe_comunicaciones=True)
        )
        db.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol.id))
        db.add(MotivoJustificacion(nombre="enfermedad", activo=True))

        tipo = TipoEvento(nombre="inasistencia.registrada", descripcion="Ausencia")
        db.add(tipo)
        db.flush()
        for nombre in ("alumno_nombre", "tipo_asistencia", "fecha"):
            db.add(
                CampoEvento(
                    nombre_interno=nombre,
                    etiqueta=nombre,
                    tipo_dato="fecha" if nombre == "fecha" else "texto",
                    tipo_evento_id=tipo.id,
                )
            )
        asistencia = Asistencia(
            inscripcion_id=inscripcion.id, fecha=date(2027, 3, 15), tipo="ausente_pendiente"
        )
        db.add(asistencia)
        db.commit()
        return {
            "usuario": usuario.id,
            "familia": familia.id,
            "alumno": alumno.id,
            "inscripcion": inscripcion.id,
            "asistencia": asistencia.id,
        }


@pytest.fixture()
def escenario_pg():
    url = _url()
    schema = f"notificaciones_race_{uuid.uuid4().hex}"
    control = create_engine(url)
    with control.begin() as conexion:
        conexion.execute(CreateSchema(schema))
    engine = create_engine(url, connect_args={"options": f"-c search_path={schema}"})
    try:
        Base.metadata.create_all(engine)
        yield engine, _cargar_escenario(engine)
    finally:
        engine.dispose()
        with control.begin() as conexion:
            conexion.execute(DropSchema(schema, cascade=True))
        control.dispose()


def _sincronizar_inserts(engine) -> tuple[threading.Barrier, object]:
    barrera = threading.Barrier(2)

    def pausa(conn, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith("INSERT INTO NOTIFICACION_INTERNA"):
            try:
                barrera.wait(timeout=5)
            except threading.BrokenBarrierError:
                pass

    event.listen(engine, "before_cursor_execute", pausa)
    return barrera, pausa


def test_dos_productores_concurrentes_dejan_una_sola_notificacion(escenario_pg):
    engine, ids = escenario_pg
    barrera, pausa = _sincronizar_inserts(engine)

    def producir(_):
        with Session(engine) as db:
            asistencia = db.get(Asistencia, ids["asistencia"])
            inscripcion = db.get(Inscripcion, asistencia.inscripcion_id)
            insertadas = registrar_ausencia(db, asistencia=asistencia, inscripcion=inscripcion)
            db.commit()
            return insertadas

    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            resultados = [
                f.result(timeout=30) for f in [pool.submit(producir, i) for i in range(2)]
            ]
    finally:
        event.remove(engine, "before_cursor_execute", pausa)

    # Las dos inserciones se encontraron en el índice único: una insertó y la otra fue no-op.
    assert not barrera.broken
    with Session(engine) as db:
        filas = db.scalars(
            select(NotificacionInterna).where(NotificacionInterna.usuario_id == ids["usuario"])
        ).all()
    assert len(filas) == 1
    assert sorted(resultados) == [0, 1]


def test_dos_lecturas_concurrentes_conservan_el_mismo_primer_leida_at(escenario_pg):
    engine, ids = escenario_pg
    with Session(engine) as db:
        notificaciones_service.publicar(
            db,
            usuario_id=ids["usuario"],
            familia_id=ids["familia"],
            alumno_id=ids["alumno"],
            ambito="academico",
            clave_hecho="academico:ausencia:carrera:2027-03-15",
            tipo=TIPO_INASISTENCIA_REGISTRADA,
            titulo="Inasistencia registrada",
            mensaje="Se registró una inasistencia.",
            contexto={
                "familia_id": str(ids["familia"]),
                "alumno_id": str(ids["alumno"]),
                "inscripcion_id": str(ids["inscripcion"]),
                "fecha": "2027-03-15",
            },
            destino_tipo="asistencia",
            destino_id=ids["asistencia"],
        )
        db.commit()
        notificacion_id = db.scalar(
            select(NotificacionInterna.id).where(NotificacionInterna.usuario_id == ids["usuario"])
        )

    barrera = threading.Barrier(2)

    def pausa(conn, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith("UPDATE NOTIFICACION_INTERNA"):
            try:
                barrera.wait(timeout=5)
            except threading.BrokenBarrierError:
                pass

    event.listen(engine, "before_cursor_execute", pausa)

    def leer(_):
        with Session(engine) as db:
            return notificaciones_service.marcar_lectura(
                db, ids["usuario"], ids["familia"], notificacion_id
            ).leida_at

    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            resultados = [f.result(timeout=30) for f in [pool.submit(leer, i) for i in range(2)]]
    finally:
        event.remove(engine, "before_cursor_execute", pausa)

    assert not barrera.broken
    with Session(engine) as db:
        persistido = db.get(NotificacionInterna, notificacion_id).leida_at
    assert resultados[0] == resultados[1]
    assert resultados[0].replace(tzinfo=None) == persistido


def test_la_clave_logica_esta_protegida_por_un_constraint_de_base(escenario_pg):
    engine, ids = escenario_pg
    with Session(engine) as db:
        db.add(
            NotificacionInterna(
                usuario_id=ids["usuario"],
                familia_id=ids["familia"],
                alumno_id=ids["alumno"],
                ambito="academico",
                clave_hecho="academico:ausencia:duplicada:2027-03-15",
                tipo=TIPO_INASISTENCIA_REGISTRADA,
                titulo="Título",
                mensaje="Mensaje",
                contexto={"fecha": "2027-03-15"},
                destino_tipo="asistencia",
                destino_id=ids["asistencia"],
            )
        )
        db.commit()

    with pytest.raises(IntegrityError):
        with engine.begin() as conexion:
            conexion.execute(
                text(
                    "insert into notificacion_interna"
                    " (id, usuario_id, familia_id, alumno_id, ambito, clave_hecho, tipo,"
                    " titulo, mensaje, contexto, destino_tipo, destino_id, created_at)"
                    " values (:id, :usuario, :familia, :alumno, 'academico',"
                    " 'academico:ausencia:duplicada:2027-03-15', :tipo, 'T', 'M', '{}'::jsonb,"
                    " 'asistencia', :asistencia, now())"
                ),
                {
                    "id": uuid.uuid4(),
                    "usuario": ids["usuario"],
                    "familia": ids["familia"],
                    "alumno": ids["alumno"],
                    "tipo": TIPO_INASISTENCIA_REGISTRADA,
                    "asistencia": ids["asistencia"],
                },
            )


def test_una_violacion_de_integridad_ajena_a_la_clave_no_se_absorbe(escenario_pg):
    """El no-op dirigido no puede tapar una FK rota: solo el UNIQUE lógico es esperado."""
    engine, ids = escenario_pg
    with Session(engine) as db, pytest.raises(IntegrityError):
        notificaciones_service.publicar(
            db,
            usuario_id=uuid.uuid4(),
            familia_id=ids["familia"],
            alumno_id=ids["alumno"],
            ambito="academico",
            clave_hecho="academico:ausencia:fk:2027-03-15",
            tipo=TIPO_INASISTENCIA_REGISTRADA,
            titulo="Inasistencia registrada",
            mensaje="Se registró una inasistencia.",
            contexto={
                "familia_id": str(ids["familia"]),
                "alumno_id": str(ids["alumno"]),
                "inscripcion_id": str(ids["inscripcion"]),
                "fecha": "2027-03-15",
            },
            destino_tipo="asistencia",
            destino_id=ids["asistencia"],
        )


def test_el_allowlist_de_lectura_deniega_filas_desconocidas_en_postgresql(escenario_pg):
    """El predicado JSONB de lectura excluye tipo y contexto desconocidos también en PG."""
    engine, ids = escenario_pg
    contexto = {
        "familia_id": str(ids["familia"]),
        "alumno_id": str(ids["alumno"]),
        "inscripcion_id": str(ids["inscripcion"]),
        "fecha": "2027-03-15",
    }
    with Session(engine) as db:
        assert notificaciones_service.publicar(
            db,
            usuario_id=ids["usuario"],
            familia_id=ids["familia"],
            alumno_id=ids["alumno"],
            ambito="academico",
            clave_hecho="academico:ausencia:valida:2027-03-15",
            tipo=TIPO_INASISTENCIA_REGISTRADA,
            titulo="Inasistencia registrada",
            mensaje="Se registró una inasistencia.",
            contexto=contexto,
            destino_tipo="asistencia",
            destino_id=ids["asistencia"],
        )
        desconocida = NotificacionInterna(
            usuario_id=ids["usuario"],
            familia_id=ids["familia"],
            alumno_id=ids["alumno"],
            ambito="academico",
            clave_hecho="academico:tipo-futuro:2027-03-15",
            tipo="academico.tipo_futuro",
            titulo="Futuro",
            mensaje="Futuro",
            contexto=contexto,
            destino_tipo="asistencia",
            destino_id=ids["asistencia"],
        )
        malformada = NotificacionInterna(
            usuario_id=ids["usuario"],
            familia_id=ids["familia"],
            alumno_id=ids["alumno"],
            ambito="academico",
            clave_hecho="academico:contexto-extra:2027-03-15",
            tipo=TIPO_INASISTENCIA_REGISTRADA,
            titulo="Extra",
            mensaje="Extra",
            contexto={**contexto, "extra": "no"},
            destino_tipo="asistencia",
            destino_id=ids["asistencia"],
        )
        db.add_all([desconocida, malformada])
        db.flush()
        denegadas = (desconocida.id, malformada.id)
        db.commit()

        listado = notificaciones_service.listar(
            db, ids["usuario"], ids["familia"], no_leidas=False, limite=20, cursor=None
        )
        assert [item.tipo for item in listado.items] == [TIPO_INASISTENCIA_REGISTRADA]
        assert listado.total_no_leidas == 1
        assert (
            notificaciones_service.resumen(db, ids["usuario"], ids["familia"]).total_no_leidas == 1
        )

        for denegada in denegadas:
            with pytest.raises(NotificacionNoEncontrada):
                notificaciones_service.marcar_lectura(db, ids["usuario"], ids["familia"], denegada)

        assert notificaciones_service.marcar_todas(db, ids["usuario"], ids["familia"]).marcadas == 1
        db.expire_all()
        assert all(db.get(NotificacionInterna, fila).leida_at is None for fila in denegadas)


def test_una_falla_inesperada_de_insercion_revierte_el_comando(escenario_pg, monkeypatch):
    engine, ids = escenario_pg
    monkeypatch.setattr(academico_service, "verificar_acceso_a_division", lambda *a, **k: None)

    def fallar(*args, **kwargs):
        raise IntegrityError("insert", {}, Exception("constraint ajena"))

    monkeypatch.setattr(notificaciones_service, "publicar", fallar)
    fecha = date(2027, 4, 1)

    with pytest.raises(IntegrityError):
        with Session(engine) as db:
            academico_service.registrar_asistencia(
                db,
                AsistenciaCreate(inscripcion_id=ids["inscripcion"], fecha=fecha, tipo="ausente"),
                ids["usuario"],
                "familia",
            )

    with engine.connect() as conexion:
        asistencias = conexion.execute(
            text("select count(*) from asistencia where inscripcion_id = :id and fecha = :fecha"),
            {"id": ids["inscripcion"], "fecha": fecha},
        ).scalar_one()
        eventos = conexion.execute(
            text("select count(*) from event_log where entidad = 'asistencia'")
        ).scalar_one()
        notificaciones = conexion.execute(
            text("select count(*) from notificacion_interna")
        ).scalar_one()
    assert asistencias == 0
    assert eventos == 0
    assert notificaciones == 0
