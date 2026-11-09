"""Independent verifier probes for communications autosave. Not an author test."""

import uuid
from unittest.mock import patch

import pytest
from sqlalchemy import func, select

from src.academico.models import AsignacionDocente, Division, Docente, Materia, MateriaCurso
from src.auth import config, sesion_service
from src.auth.models import Permiso, Rol, RolPermiso, Usuario, UsuarioRol
from src.comunicaciones.models import ReciboComunicacion
from src.inscripciones.models import Inscripcion
from src.models import AuditLog, Persona
from src.workflows.models import EnvioNotificacion


def _otorgar(db, nombre, usuarios, acciones, tipo=None):
    rol = Rol(nombre=nombre)
    db.add(rol)
    db.flush()
    for usuario_id in usuarios:
        db.add(UsuarioRol(usuario_id=usuario_id, rol_id=rol.id))
    for accion in acciones:
        codigo = f"comunicaciones.{accion}" + (f":{tipo}" if tipo else "")
        permiso = db.scalar(select(Permiso).where(Permiso.codigo == codigo))
        if permiso is None:
            permiso = Permiso(modulo="Comunicaciones", accion=accion, tipo_informacion=tipo)
            db.add(permiso)
            db.flush()
        db.add(RolPermiso(rol_id=rol.id, permiso_id=permiso.id))


@pytest.fixture()
def gestion(client, db_session, escenario_dos_familias):
    ids = escenario_dos_familias
    staff = Usuario(email="verificador@example.test", estado="activo", auth_provider="local")
    db_session.add(staff)
    db_session.flush()
    _otorgar(db_session, "administración", [staff.id], ["crear", "leer", "actualizar"])
    db_session.commit()
    client.cookies.set(
        config.COOKIE_SESION, sesion_service.crear_access_token(staff.id, "administracion")
    )
    ids["staff"] = staff.id
    return ids


@pytest.fixture()
def docente(client, db_session, escenario_dos_familias):
    ids = escenario_dos_familias
    persona = Persona(nombre="Laura", apellido="Díaz", dni="90000555")
    db_session.add(persona)
    db_session.flush()
    usuario = Usuario(
        email="docente@example.test", estado="activo", auth_provider="local", persona_id=persona.id
    )
    perfil = Docente(persona_id=persona.id, legajo="DOC-VERIF")
    ajena = Division(nombre="Otra división", anio_id=ids["anio"])
    materia = Materia(nombre="Lengua", tipo="materia")
    db_session.add_all([usuario, perfil, ajena, materia])
    db_session.flush()
    materia_curso = MateriaCurso(materia_id=materia.id, division_id=ids["division"])
    db_session.add(materia_curso)
    db_session.flush()
    db_session.add(
        AsignacionDocente(
            docente_id=perfil.id,
            materia_curso_id=materia_curso.id,
            ciclo_lectivo="2027",
        )
    )
    db_session.get(Inscripcion, ids["inscripcion_b"]).division_id = ajena.id
    _otorgar(db_session, "docente", [usuario.id], ["crear", "leer", "actualizar"], "docente")
    db_session.commit()
    ids.update(division_ajena=ajena.id, docente_usuario=usuario.id)
    client.cookies.set(
        config.COOKIE_SESION, sesion_service.crear_access_token(usuario.id, "docente")
    )
    return ids


def datos(ids, **cambios):
    data = {
        "clave": str(uuid.uuid4()),
        "asunto": "Reunión institucional",
        "cuerpo": "Información para las familias.",
        "audiencia": {"tipo": "alumnos", "ids": [str(ids["alumno_a"])]},
    }
    data.update(cambios)
    return data


def sin_publicacion(db):
    return {
        "recibos": db.scalar(select(func.count()).select_from(ReciboComunicacion)),
        "envios": db.scalar(select(func.count()).select_from(EnvioNotificacion)),
        "publicadas": db.scalar(
            select(func.count())
            .select_from(AuditLog)
            .where(AuditLog.campo == "estado", AuditLog.valor_nuevo == "publicada")
        ),
    }


def _png():
    from io import BytesIO

    from PIL import Image

    buffer = BytesIO()
    Image.new("RGB", (12, 12), "red").save(buffer, format="PNG")
    return buffer.getvalue()


def _habilitar_adjuntos(monkeypatch):
    from src.comunicaciones import adjuntos_escaner, adjuntos_service

    monkeypatch.setattr(adjuntos_service.settings, "COMUNICACIONES_ADJUNTOS_HABILITADOS", True)
    monkeypatch.setattr(adjuntos_escaner, "escanear", lambda contenido: None)


def _snapshot(db):
    from src.models import Base

    return {
        tabla.name: sorted(repr(tuple(fila)) for fila in db.execute(select(tabla)))
        for tabla in Base.metadata.sorted_tables
    }


def test_invariante_rechazos_no_mutan_ninguna_tabla(client, gestion, db_session):
    ids = gestion
    original = datos(ids)
    creado = client.post("/comunicaciones", json=original).json()
    assert (
        client.put(
            f"/comunicaciones/{creado['id']}",
            json={**original, "asunto": "Primera", "version": creado["version"]},
        ).status_code
        == 200
    )

    antes = _snapshot(db_session)
    rechazo = client.put(
        f"/comunicaciones/{creado['id']}",
        json={**original, "asunto": "Obsoleta", "version": creado["version"]},
    )
    assert rechazo.status_code == 409
    assert _snapshot(db_session) == antes, "un 409 de edición no debe mutar datos"

    rechazo = client.post(
        f"/comunicaciones/{creado['id']}/publicar", json={"version": creado["version"]}
    )
    assert rechazo.status_code == 409
    assert _snapshot(db_session) == antes, "un 409 de publicación no debe mutar datos"

    incompleto = client.post(
        "/comunicaciones",
        json=datos(
            ids,
            asunto="",
            cuerpo="",
            audiencia={"tipo": "alumnos", "ids": []},
            canal="ambos",
        ),
    ).json()
    antes = _snapshot(db_session)
    rechazo = client.post(
        f"/comunicaciones/{incompleto['id']}/publicar", json={"version": incompleto["version"]}
    )
    assert rechazo.status_code == 422
    assert _snapshot(db_session) == antes, "un 422 de publicación no debe mutar datos"


def test_invariante_docente_rechazado_no_muta_ninguna_tabla(client, docente, db_session):
    ids = docente
    propio = {
        "clave": str(uuid.uuid4()),
        "asunto": "",
        "cuerpo": "",
        "audiencia": {"tipo": "division", "ids": [], "ciclo_lectivo": "2027"},
    }
    creado = client.post("/comunicaciones/docente", json=propio).json()
    antes = _snapshot(db_session)
    rechazo = client.put(
        f"/comunicaciones/docente/{creado['id']}",
        json={
            **propio,
            "asunto": "Fuera de alcance",
            "audiencia": {
                "tipo": "division",
                "ids": [str(ids["division_ajena"])],
                "ciclo_lectivo": "2027",
            },
            "version": creado["version"],
        },
    )
    assert rechazo.status_code == 403
    assert _snapshot(db_session) == antes, "un 403 docente no debe mutar datos"


def test_s6_autosave_no_publica_ni_crea_envios_ni_llama_n8n(client, gestion, db_session):
    ids = gestion
    original = datos(ids, canal="ambos")
    with (
        patch(
            "src.workflows.manuales_service.preparar_envios",
            side_effect=AssertionError("autosave no debe preparar envios"),
        ),
        patch(
            "src.workflows.n8n_client.enviar_email_manual",
            side_effect=AssertionError("autosave no debe invocar n8n"),
        ),
    ):
        creado = client.post("/comunicaciones", json=original)
        assert creado.status_code == 201, creado.text
        cuerpo = creado.json()
        assert cuerpo["estado"] == "borrador"
        editado = client.put(
            f"/comunicaciones/{cuerpo['id']}",
            json={**original, "asunto": "Editado sin publicar", "version": cuerpo["version"]},
        )
        assert editado.status_code == 200, editado.text
        assert editado.json()["estado"] == "borrador"
        assert editado.json()["version"] == 2
        assert editado.json()["publicada_at"] is None
    assert sin_publicacion(db_session) == {"recibos": 0, "envios": 0, "publicadas": 0}
    actual = client.get(f"/comunicaciones/{cuerpo['id']}").json()
    assert actual["estado"] == "borrador"
    assert actual["asunto"] == "Editado sin publicar"


def test_s7_adjunto_sigue_asociado_tras_autosave_y_publicacion(
    client, gestion, db_session, monkeypatch
):
    _habilitar_adjuntos(monkeypatch)
    ids = gestion
    creado = client.post(
        "/comunicaciones",
        json=datos(
            ids,
            asunto="",
            cuerpo="",
            audiencia={"tipo": "alumnos", "ids": []},
        ),
    ).json()
    imagen = _png()
    subida = client.post(
        f"/comunicaciones/{creado['id']}/adjuntos",
        files={"archivo": ("material.png", imagen, "image/png")},
    )
    assert subida.status_code == 201, subida.text
    adjunto = subida.json()
    assert adjunto["estado"] == "limpio"

    # Simulated reload/reopen: detail returns the associated attachment.
    detalle = client.get(f"/comunicaciones/{creado['id']}").json()
    assert [a["id"] for a in detalle["adjuntos"]] == [adjunto["id"]]

    # Autosave text edit keeps the attachment associated.
    editado = client.put(
        f"/comunicaciones/{creado['id']}",
        json=datos(
            ids,
            clave=creado["clave"],
            asunto="Material",
            cuerpo="Adjuntamos el material.",
            version=creado["version"],
        ),
    )
    assert editado.status_code == 200, editado.text
    detalle = client.get(f"/comunicaciones/{creado['id']}").json()
    assert [a["id"] for a in detalle["adjuntos"]] == [adjunto["id"]]

    publicado = client.post(
        f"/comunicaciones/{creado['id']}/publicar", json={"version": editado.json()["version"]}
    )
    assert publicado.status_code == 200, publicado.text
    assert [a["id"] for a in publicado.json()["adjuntos"]] == [adjunto["id"]]
    assert db_session.scalar(select(func.count()).select_from(ReciboComunicacion)) == 1


def test_s7_docente_adjunta_a_borrador_incompleto_sin_romper_alcance(
    client, docente, db_session, monkeypatch
):
    _habilitar_adjuntos(monkeypatch)
    ids = docente
    propio = {
        "clave": str(uuid.uuid4()),
        "asunto": "",
        "cuerpo": "",
        "audiencia": {"tipo": "division", "ids": [], "ciclo_lectivo": "2027"},
    }
    creado = client.post("/comunicaciones/docente", json=propio)
    assert creado.status_code == 201, creado.text
    subida = client.post(
        f"/comunicaciones/docente/{creado.json()['id']}/adjuntos",
        files={"archivo": ("material.png", _png(), "image/png")},
    )
    assert subida.status_code == 201, subida.text
    assert subida.json()["estado"] == "limpio"

    rechazo = client.put(
        f"/comunicaciones/docente/{creado.json()['id']}",
        json={
            **propio,
            "asunto": "Fuera",
            "audiencia": {
                "tipo": "division",
                "ids": [str(ids["division_ajena"])],
                "ciclo_lectivo": "2027",
            },
            "version": creado.json()["version"],
        },
    )
    assert rechazo.status_code == 403, rechazo.text
    detalle = client.get(f"/comunicaciones/docente/{creado.json()['id']}").json()
    assert [a["id"] for a in detalle["adjuntos"]] == [subida.json()["id"]]


def test_compat_clientes_sin_version(client, gestion):
    ids = gestion
    original = datos(ids)
    creado = client.post("/comunicaciones", json=original).json()
    editado = client.put(
        f"/comunicaciones/{creado['id']}", json={**original, "asunto": "Sin versión uno"}
    )
    assert editado.status_code == 200, editado.text
    assert editado.json()["version"] == 2
    # A version-less edit still overwrites a newer version (pre-version contract).
    silenciosa = client.put(
        f"/comunicaciones/{creado['id']}", json={**original, "asunto": "Sin versión dos"}
    )
    assert silenciosa.status_code == 200, silenciosa.text
    assert silenciosa.json()["version"] == 3
    assert client.get(f"/comunicaciones/{creado['id']}").json()["asunto"] == "Sin versión dos"
    publicacion = client.post(f"/comunicaciones/{creado['id']}/publicar")
    assert publicacion.status_code == 200, publicacion.text
