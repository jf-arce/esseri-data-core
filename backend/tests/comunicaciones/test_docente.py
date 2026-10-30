"""Teacher publication uses real active-role permissions and persisted academic assignments."""

import uuid

import pytest
from sqlalchemy import func, select

from src.academico.models import AsignacionDocente, Division, Docente, Materia
from src.auth import config, sesion_service
from src.auth.models import Permiso, Rol, RolPermiso, Usuario, UsuarioRol
from src.comunicaciones.models import ReciboComunicacion
from src.familias_alumnos.models import FamiliaAlumno
from src.inscripciones.models import Inscripcion
from src.models import Base, Persona


@pytest.fixture()
def docente(client, db_session, escenario_dos_familias):
    ids = escenario_dos_familias
    persona = Persona(nombre="Laura", apellido="Díaz", dni="90000555")
    db_session.add(persona)
    db_session.flush()
    usuario = Usuario(
        email="docente@example.test", estado="activo", auth_provider="local", persona_id=persona.id
    )
    perfil = Docente(persona_id=persona.id, legajo="DOC-COM")
    ajena = Division(nombre="Otra división", anio_id=ids["anio"])
    materia = Materia(nombre="Lengua", tipo="materia", anio_id=ids["anio"])
    db_session.add_all([usuario, perfil, ajena, materia])
    db_session.flush()
    asignacion = AsignacionDocente(
        docente_id=perfil.id,
        materia_id=materia.id,
        division_id=ids["division"],
        ciclo_lectivo="2027",
    )
    db_session.add(asignacion)
    db_session.get(Inscripcion, ids["inscripcion_b"]).division_id = ajena.id
    for nombre, acciones, tipo in (
        ("docente", ["crear", "leer", "actualizar"], "docente"),
        ("administración", ["crear", "leer", "actualizar"], None),
        ("familia", ["leer"], None),
    ):
        rol = Rol(nombre=nombre)
        db_session.add(rol)
        db_session.flush()
        usuarios = [usuario.id] if nombre != "familia" else [ids["usuario_a"], ids["usuario_otro"]]
        if nombre == "docente":
            usuarios.append(ids["usuario_otro"])
        for usuario_id in usuarios:
            db_session.add(UsuarioRol(usuario_id=usuario_id, rol_id=rol.id))
        for accion in acciones:
            codigo = f"comunicaciones.{accion}" + (f":{tipo}" if tipo else "")
            permiso = db_session.scalar(select(Permiso).where(Permiso.codigo == codigo))
            if permiso is None:
                permiso = Permiso(modulo="Comunicaciones", accion=accion, tipo_informacion=tipo)
                db_session.add(permiso)
                db_session.flush()
            db_session.add(RolPermiso(rol_id=rol.id, permiso_id=permiso.id))
    db_session.commit()
    ids.update(
        docente_usuario=usuario.id,
        docente_perfil=perfil.id,
        division_ajena=ajena.id,
        asignacion=asignacion.id,
    )

    def entrar(rol="docente", usuario_id=usuario.id):
        client.cookies.set(config.COOKIE_SESION, sesion_service.crear_access_token(usuario_id, rol))

    entrar()
    return ids, entrar


def datos(ids, tipo="division", seleccion=None, ciclo="2027"):
    return {
        "clave": str(uuid.uuid4()),
        "asunto": "Materiales para la clase",
        "cuerpo": "Traer una botella.",
        "audiencia": {
            "tipo": tipo,
            "ids": seleccion if seleccion is not None else [str(ids["division"])],
            "ciclo_lectivo": ciclo,
        },
    }


def estado(db):
    return {
        t.name: sorted(repr(tuple(r)) for r in db.execute(select(t)))
        for t in Base.metadata.sorted_tables
    }


def test_publica_curso_y_familia_autorizada_lee(client, docente):
    ids, entrar = docente
    opciones = client.get("/comunicaciones/docente/opciones?ciclo_lectivo=2027")
    assert opciones.status_code == 200
    assert [str(o["id"]) for o in opciones.json()["divisiones"]] == [str(ids["division"])]
    assert [str(o["id"]) for o in opciones.json()["alumnos"]] == [str(ids["alumno_a"])]
    assert opciones.json()["responsables"] == []
    preview = client.post("/comunicaciones/docente/vista-previa", json=datos(ids))
    assert preview.status_code == 200
    assert preview.json()["destinatarios"] == 1
    borrador = client.post("/comunicaciones/docente", json=datos(ids))
    assert borrador.status_code == 201
    id = borrador.json()["id"]
    assert borrador.json()["tipo"] == "curso"
    assert client.get("/comunicaciones/docente").json()["total"] == 1
    publicada = client.post(f"/comunicaciones/docente/{id}/publicar")
    assert publicada.status_code == 200
    assert client.post(f"/comunicaciones/docente/{id}/publicar").json() == publicada.json()
    assert client.get(f"/comunicaciones/docente/{id}").status_code == 200
    entrar("familia", ids["usuario_a"])
    assert client.get("/comunicaciones/familia").json()["total"] == 1
    lectura = client.put(f"/comunicaciones/familia/{id}/lectura")
    assert lectura.status_code == 200
    assert lectura.json()["leida_at"]
    assert lectura.json()["emisor"] == "Laura Díaz"
    entrar("familia", ids["usuario_otro"])
    assert client.get("/comunicaciones/familia").json()["total"] == 0
    assert client.get(f"/comunicaciones/familia/{id}").status_code == 404


@pytest.mark.parametrize(
    "seleccion",
    ["ajena", "mixta", "alumno_ajeno", "alumnos_mixtos", "todos", "responsables", "ciclo"],
)
def test_audiencia_fuera_de_alcance_no_persiste(client, docente, db_session, seleccion):
    ids, _ = docente
    body = datos(ids)
    if seleccion in ("ajena", "mixta"):
        body = datos(
            ids,
            seleccion=[str(ids["division_ajena"])]
            + ([str(ids["division"])] if seleccion == "mixta" else []),
        )
    elif seleccion in ("alumno_ajeno", "alumnos_mixtos"):
        body = datos(
            ids,
            "alumnos",
            [str(ids["alumno_b"])]
            + ([str(ids["alumno_a"])] if seleccion == "alumnos_mixtos" else []),
        )
    elif seleccion == "todos":
        body = datos(ids, "todos", [])
    elif seleccion == "responsables":
        body = datos(ids, "responsables", [str(ids["familia_a"])])
    else:
        body = datos(ids, ciclo="2026")
    antes = estado(db_session)
    assert client.post("/comunicaciones/docente/vista-previa", json=body).status_code == 403
    assert client.post("/comunicaciones/docente", json=body).status_code == 403
    assert estado(db_session) == antes


def test_seleccion_alumnos_y_revalidacion_al_publicar(client, docente, db_session):
    ids, _ = docente
    body = datos(ids, "alumnos", [str(ids["alumno_a"])])
    creada = client.post("/comunicaciones/docente", json=body)
    assert creada.status_code == 201
    id = creada.json()["id"]
    assert client.post("/comunicaciones/docente", json=body).json()["id"] == id
    assert (
        client.put(
            f"/comunicaciones/docente/{id}", json={**body, "asunto": "Nuevo asunto"}
        ).status_code
        == 200
    )
    db_session.delete(db_session.get(AsignacionDocente, ids["asignacion"]))
    db_session.commit()
    antes = estado(db_session)
    assert client.post(f"/comunicaciones/docente/{id}/publicar").status_code == 403
    assert client.put(f"/comunicaciones/docente/{id}", json=body).status_code == 403
    assert estado(db_session) == antes


def test_permiso_tipado_no_abre_endpoints_administrativos(client, docente, db_session):
    ids, _ = docente
    antes = estado(db_session)
    assert client.get("/comunicaciones").status_code == 403
    assert client.get("/comunicaciones/opciones").status_code == 403
    assert client.post("/comunicaciones", json=datos(ids, "todos", [])).status_code == 403
    assert (
        client.post("/comunicaciones/vista-previa", json=datos(ids, "todos", [])).status_code == 403
    )
    assert estado(db_session) == antes


def test_historial_y_cambio_de_rol_no_exponen_borradores(client, docente, db_session):
    ids, entrar = docente
    body = datos(ids)
    entrar("administracion")
    institucional = client.post("/comunicaciones", json=body)
    assert institucional.status_code == 201
    entrar()
    assert client.get(f"/comunicaciones/docente/{institucional.json()['id']}").status_code == 404
    assert (
        client.post(f"/comunicaciones/docente/{institucional.json()['id']}/publicar").status_code
        == 404
    )
    creada = client.post("/comunicaciones/docente", json=datos(ids))
    assert creada.status_code == 201
    id = creada.json()["id"]
    entrar("administracion")
    antes = estado(db_session)
    historial = client.get("/comunicaciones")
    assert historial.status_code == 200
    assert [c["id"] for c in historial.json()["items"]] == [institucional.json()["id"]]
    assert client.get(f"/comunicaciones/{id}").status_code == 404
    assert client.put(f"/comunicaciones/{id}", json=body).status_code == 404
    assert client.post(f"/comunicaciones/{id}/publicar").status_code == 404
    assert estado(db_session) == antes
    entrar()
    assert client.get(f"/comunicaciones/docente/{id}").status_code == 200
    assert client.post(f"/comunicaciones/docente/{id}/publicar").status_code == 200
    entrar("administracion")
    assert client.get(f"/comunicaciones/{id}").status_code == 200
    assert {c["id"] for c in client.get("/comunicaciones").json()["items"]} == {
        institucional.json()["id"],
        id,
    }
    entrar("docente", ids["usuario_otro"])
    assert client.get("/comunicaciones/docente").json()["total"] == 0
    assert client.get(f"/comunicaciones/docente/{id}").status_code == 404
    assert client.post("/comunicaciones/docente", json=datos(ids)).status_code == 403
    assert (
        client.get("/comunicaciones/docente/opciones?ciclo_lectivo=2027").json()["divisiones"] == []
    )


def test_reutiliza_deduplicacion_y_respeta_destinatarios_habilitados(client, docente, db_session):
    ids, entrar = docente
    db_session.add(
        FamiliaAlumno(
            familia_id=ids["familia_a"], alumno_id=ids["alumno_a"], recibe_comunicaciones=True
        )
    )
    db_session.commit()
    creada = client.post("/comunicaciones/docente", json=datos(ids))
    assert creada.status_code == 201
    publicada = client.post(f"/comunicaciones/docente/{creada.json()['id']}/publicar")
    assert publicada.json()["destinatarios"] == 1
    entrar("familia", ids["usuario_a"])
    assert client.get("/comunicaciones/familia").json()["total"] == 1


def test_un_recibo_por_responsable_y_reintento_sin_duplicados(client, docente, db_session):
    ids, _ = docente
    db_session.get(FamiliaAlumno, ids["vinculo_c"]).recibe_comunicaciones = True
    db_session.commit()
    body = datos(ids, tipo="alumnos", seleccion=[str(ids["alumno_a"])])
    assert (
        client.post("/comunicaciones/docente/vista-previa", json=body).json()["destinatarios"] == 2
    )
    cid = uuid.UUID(client.post("/comunicaciones/docente", json=body).json()["id"])
    primera = client.post(f"/comunicaciones/docente/{cid}/publicar")
    segunda = client.post(f"/comunicaciones/docente/{cid}/publicar")
    assert primera.status_code == segunda.status_code == 200
    assert primera.json()["destinatarios"] == segunda.json()["destinatarios"] == 2
    filas = db_session.scalar(
        select(func.count())
        .select_from(ReciboComunicacion)
        .where(ReciboComunicacion.comunicacion_id == cid)
    )
    familias = db_session.scalar(
        select(func.count(func.distinct(ReciboComunicacion.familia_id))).where(
            ReciboComunicacion.comunicacion_id == cid
        )
    )
    assert (filas, familias) == (2, 2)
