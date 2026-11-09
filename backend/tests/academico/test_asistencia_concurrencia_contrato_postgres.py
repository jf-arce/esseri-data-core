"""Additional isolated PostgreSQL probes for attendance lock invariants."""

import os
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from datetime import date

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, event, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from src.academico import service
from src.academico.exceptions import AsistenciaDuplicada
from src.academico.models import JustificacionInasistencia, MotivoJustificacion
from src.academico.schemas import AsistenciaBulkCreate, AsistenciaCreate
from src.auth.exceptions import PermisoDenegado
from src.familias_alumnos.models import Familia
from src.inscripciones.models import Asistencia
from src.models import Persona
from src.workflows.models import TipoEvento


def _engine():
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
    return create_engine(url)


def _scenario(engine, students=2):
    ids = {key: uuid.uuid4() for key in ("usuario", "nivel", "anio", "division")}
    inscripciones = []
    with engine.begin() as conn:
        conn.execute(
            text(
                "insert into usuario(id,email,auth_provider,estado) "
                "values (:id,:email,'local','activo')"
            ),
            {"id": ids["usuario"], "email": f"{ids['usuario']}@example.test"},
        )
        conn.execute(
            text("insert into nivel_educativo(id,nombre) values (:id,'Test')"), {"id": ids["nivel"]}
        )
        conn.execute(
            text("insert into anio(id,numero,nivel_educativo_id) values (:id,1,:n)"),
            {"id": ids["anio"], "n": ids["nivel"]},
        )
        conn.execute(
            text("insert into division(id,nombre,anio_id) values (:id,'Test',:a)"),
            {"id": ids["division"], "a": ids["anio"]},
        )
        for _ in range(students):
            persona, alumno, inscripcion = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
            conn.execute(
                text(
                    "insert into persona(id,nombre,apellido,dni) values (:id,'Test','Student',:dni)"
                ),
                {"id": persona, "dni": str(persona)},
            )
            conn.execute(
                text(
                    "insert into alumno(id,numero_legajo,estado,persona_id) "
                    "values (:id,:legajo,'activo',:persona)"
                ),
                {"id": alumno, "legajo": str(alumno), "persona": persona},
            )
            conn.execute(
                text(
                    "insert into inscripcion(id,ciclo_lectivo,fecha_inscripcion,tipo,"
                    "estado,alumno_id,division_id) values "
                    "(:id,'2026','2026-01-01','nueva','activa',:alumno,:division)"
                ),
                {"id": inscripcion, "alumno": alumno, "division": ids["division"]},
            )
            inscripciones.append(inscripcion)
    return ids, inscripciones


def test_bulk_reversed_orders_serialize_without_deadlock_or_duplicates(monkeypatch):
    engine = _engine()
    ids, inscripciones = _scenario(engine)
    fecha = date(2026, 5, 1)
    monkeypatch.setattr(service, "verificar_acceso_a_division", lambda *args: None)
    barrier = threading.Barrier(2)
    waited = set()

    def pause(conn, cursor, statement, parameters, context, executemany):
        if "FROM asistencia" in statement and "asistencia.fecha" in statement:
            name = threading.current_thread().name
            if name not in waited:
                waited.add(name)
                try:
                    barrier.wait(timeout=2)
                except threading.BrokenBarrierError:
                    pass

    event.listen(engine, "after_cursor_execute", pause)

    def register(order):
        with Session(engine) as db:
            return service.registrar_asistencia_masiva(
                db,
                AsistenciaBulkCreate(
                    division_id=ids["division"],
                    fecha=fecha,
                    registros=[
                        {"inscripcion_id": inscripciones[i], "tipo": "presente"} for i in order
                    ],
                ),
                ids["usuario"],
                "docente",
            )

    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(register, [0, 1]), pool.submit(register, [1, 0])]
            results = [future.result(timeout=30) for future in futures]
        with engine.connect() as conn:
            counts = dict(
                conn.execute(
                    text(
                        "select inscripcion_id,count(*) from asistencia where fecha=:fecha "
                        "and inscripcion_id = any(:ids) group by inscripcion_id"
                    ),
                    {"fecha": fecha, "ids": inscripciones},
                ).all()
            )
        assert counts == {inscripcion: 1 for inscripcion in inscripciones}
        assert sorted(result.creadas for result in results) == [0, 2]
    finally:
        event.remove(engine, "after_cursor_execute", pause)
        engine.dispose()


def test_duplicate_rejection_does_not_change_persisted_data(monkeypatch):
    engine = _engine()
    monkeypatch.setattr(service, "verificar_acceso_a_division", lambda *args: None)
    ids, inscripciones = _scenario(engine, students=1)
    data = AsistenciaCreate(
        inscripcion_id=inscripciones[0], fecha=date(2026, 7, 1), tipo="presente"
    )
    with Session(engine) as db:
        service.registrar_asistencia(db, data, ids["usuario"], "docente")

    def hashes():
        with engine.connect() as conn:
            return {
                table: conn.execute(
                    text(
                        f"select md5(coalesce(string_agg(md5(t::text), '' order by t.id), '')) "
                        f"from {table} t"
                    )
                ).scalar_one()
                for table in ("asistencia", "audit_log", "event_log")
            }

    try:
        before = hashes()
        with Session(engine) as db:
            with pytest.raises(AsistenciaDuplicada):
                service.registrar_asistencia(db, data, ids["usuario"], "docente")
            db.rollback()
        assert hashes() == before
    finally:
        engine.dispose()


def test_permission_denied_before_student_lock():
    engine = _engine()
    _, inscripciones = _scenario(engine, students=1)
    statements = []

    def record(conn, cursor, statement, parameters, context, executemany):
        if "FOR UPDATE" in statement:
            statements.append(statement)

    event.listen(engine, "before_cursor_execute", record)
    try:
        with Session(engine) as db, pytest.raises(PermisoDenegado):
            service.registrar_asistencia(
                db,
                AsistenciaCreate(
                    inscripcion_id=inscripciones[0], fecha=date(2026, 8, 1), tipo="presente"
                ),
                uuid.uuid4(),
                "docente",
            )
        with engine.connect() as conn:
            count = conn.execute(
                text("select count(*) from asistencia where inscripcion_id=:id"),
                {"id": inscripciones[0]},
            ).scalar_one()
        assert statements == []
        assert count == 0
    finally:
        event.remove(engine, "before_cursor_execute", record)
        engine.dispose()


def test_bulk_and_historical_approval_do_not_overwrite_each_other(monkeypatch):
    engine = _engine()
    ids, inscripciones = _scenario(engine, students=1)
    monkeypatch.setattr(service, "verificar_acceso_a_division", lambda *args: None)
    with Session(engine) as db:
        persona = Persona(nombre="Test", apellido="Familia", dni=str(uuid.uuid4()))
        db.add(persona)
        db.flush()
        familia = Familia(persona_id=persona.id)
        motivo = MotivoJustificacion(nombre="Test", activo=True)
        asistencia = Asistencia(
            inscripcion_id=inscripciones[0], fecha=date(2026, 9, 1), tipo="ausente_pendiente"
        )
        db.add_all([familia, motivo, asistencia])
        if (
            db.scalar(select(TipoEvento).where(TipoEvento.nombre == "inasistencia.justificada"))
            is None
        ):
            db.add(TipoEvento(nombre="inasistencia.justificada"))
        db.flush()
        justificacion = JustificacionInasistencia(
            asistencia_id=asistencia.id,
            familia_id=familia.id,
            motivo_justificacion_id=motivo.id,
            usuario_id=ids["usuario"],
            estado="pendiente",
        )
        db.add(justificacion)
        db.commit()
        asistencia_id, justificacion_id = asistencia.id, justificacion.id

    read, release = threading.Event(), threading.Event()

    def pause_bulk(conn, cursor, statement, parameters, context, executemany):
        if (
            threading.current_thread().name.startswith("bulk-race")
            and "FROM asistencia" in statement
        ):
            if not read.is_set():
                read.set()
                release.wait(5)

    def bulk():
        with Session(engine) as db:
            return service.registrar_asistencia_masiva(
                db,
                AsistenciaBulkCreate(
                    division_id=ids["division"],
                    fecha=date(2026, 9, 1),
                    registros=[{"inscripcion_id": inscripciones[0], "tipo": "presente"}],
                ),
                ids["usuario"],
                "docente",
            )

    def approve():
        with Session(engine) as db:
            try:
                service.resolver_justificacion(
                    db,
                    db.get(JustificacionInasistencia, justificacion_id),
                    True,
                    usuario_id=ids["usuario"],
                )
                return "approved"
            except HTTPException as exc:
                db.rollback()
                return exc.status_code

    event.listen(engine, "after_cursor_execute", pause_bulk)
    try:
        with (
            ThreadPoolExecutor(max_workers=1, thread_name_prefix="bulk-race") as b,
            ThreadPoolExecutor(max_workers=1) as a,
        ):
            bulk_result = b.submit(bulk)
            assert read.wait(5)
            approval = a.submit(approve)
            try:
                with pytest.raises(TimeoutError):
                    approval.result(timeout=0.5)
            finally:
                release.set()
            assert bulk_result.result(timeout=10).actualizadas == 1
            assert approval.result(timeout=10) == 409
        with Session(engine) as db:
            assert db.get(Asistencia, asistencia_id).tipo == "presente"
            assert db.get(JustificacionInasistencia, justificacion_id).estado == "pendiente"
            service.resolver_justificacion(
                db,
                db.get(JustificacionInasistencia, justificacion_id),
                False,
                observacion="No longer absent",
                usuario_id=ids["usuario"],
            )
            assert db.get(Asistencia, asistencia_id).tipo == "presente"
            assert db.get(JustificacionInasistencia, justificacion_id).estado == "rechazada"
    finally:
        release.set()
        event.remove(engine, "after_cursor_execute", pause_bulk)
        engine.dispose()


@pytest.mark.parametrize(
    "tipo", ["presente", "tardanza", "ausente_justificado", "ausente_injustificado"]
)
@pytest.mark.parametrize("aprobar", [True, False])
def test_historical_resolution_preserves_nonpending_attendance(tipo, aprobar):
    engine = _engine()
    ids, inscripciones = _scenario(engine, students=1)
    try:
        with Session(engine) as db:
            persona = Persona(nombre="Test", apellido="Familia", dni=str(uuid.uuid4()))
            db.add(persona)
            db.flush()
            familia = Familia(persona_id=persona.id)
            motivo = MotivoJustificacion(nombre="Test", activo=True)
            asistencia = Asistencia(
                inscripcion_id=inscripciones[0], fecha=date(2026, 9, 2), tipo=tipo
            )
            db.add_all([familia, motivo, asistencia])
            if (
                db.scalar(select(TipoEvento).where(TipoEvento.nombre == "inasistencia.justificada"))
                is None
            ):
                db.add(TipoEvento(nombre="inasistencia.justificada"))
            db.flush()
            justificacion = JustificacionInasistencia(
                asistencia_id=asistencia.id,
                familia_id=familia.id,
                motivo_justificacion_id=motivo.id,
                usuario_id=ids["usuario"],
                estado="pendiente",
            )
            db.add(justificacion)
            db.commit()
            if aprobar:
                with pytest.raises(HTTPException) as exc:
                    service.resolver_justificacion(
                        db, justificacion, True, usuario_id=ids["usuario"]
                    )
                assert exc.value.status_code == 409
                db.rollback()
                assert justificacion.estado == "pendiente"
            else:
                result = service.resolver_justificacion(
                    db,
                    justificacion,
                    False,
                    observacion="No longer absent",
                    usuario_id=ids["usuario"],
                )
                assert result.estado == "rechazada"
            assert db.get(Asistencia, asistencia.id).tipo == tipo
    finally:
        engine.dispose()
