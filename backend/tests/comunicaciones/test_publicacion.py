"""Persistent public API tests for institutional publication and individual reading."""

import uuid

import pytest
from sqlalchemy import select

from src.auth import config, sesion_service
from src.auth.models import Permiso, Rol, RolPermiso, Usuario, UsuarioRol
from src.familias_alumnos.models import FamiliaAlumno
from src.models import AuditLog, Base


@pytest.fixture()
def escenario(client, db_session, escenario_dos_familias):
    ids = escenario_dos_familias
    staff = Usuario(email="communications@example.test", estado="activo", auth_provider="local")
    db_session.add(staff)
    db_session.flush()
    for nombre, usuario_id, acciones in (
        ("administración", staff.id, ["crear", "leer", "actualizar"]),
        ("familia", ids["usuario_a"], ["leer"]),
        ("docente", staff.id, []),
    ):
        rol = Rol(nombre=nombre)
        db_session.add(rol)
        db_session.flush()
        db_session.add(UsuarioRol(usuario_id=usuario_id, rol_id=rol.id))
        for accion in acciones:
            permiso = db_session.scalar(
                select(Permiso).where(Permiso.codigo == f"comunicaciones.{accion}")
            )
            if permiso is None:
                permiso = Permiso(modulo="Comunicaciones", accion=accion)
                db_session.add(permiso)
                db_session.flush()
            db_session.add(RolPermiso(rol_id=rol.id, permiso_id=permiso.id))
    db_session.commit()

    def entrar(usuario_id=staff.id, rol="administracion"):
        client.cookies.set(config.COOKIE_SESION, sesion_service.crear_access_token(usuario_id, rol))

    entrar()
    return ids, entrar


def datos(ids, **cambios):
    return {
        "clave": str(uuid.uuid4()),
        "asunto": "Reunión institucional",
        "cuerpo": "Información para las familias. <script>alert(1)</script>",
        "audiencia": {"tipo": "alumnos", "ids": [str(ids["alumno_a"])]},
        **cambios,
    }


def crear(client, ids, **cambios):
    respuesta = client.post("/comunicaciones", json=datos(ids, **cambios))
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


def snapshot(db):
    return {
        t.name: sorted(repr(tuple(r)) for r in db.execute(select(t)))
        for t in Base.metadata.sorted_tables
    }


@pytest.mark.parametrize("tipo", ["administrativa", "otro"])
def test_nuevos_tipos_se_guardan_editan_publican_y_leen(client, escenario, tipo):
    ids, entrar = escenario
    payload = datos(ids, tipo=tipo)
    response = client.post("/comunicaciones", json=payload)
    assert response.status_code == 201, response.text
    c = response.json()
    assert c["tipo"] == tipo
    assert client.post("/comunicaciones", json=payload).json()["id"] == c["id"]
    assert c["id"] in [i["id"] for i in client.get("/comunicaciones").json()["items"]]
    edited = client.put(f"/comunicaciones/{c['id']}", json={**payload, "asunto": "Actualizado"})
    assert edited.status_code == 200, edited.text
    assert edited.json()["tipo"] == tipo
    published = client.post(f"/comunicaciones/{c['id']}/publicar")
    assert published.status_code == 200, published.text
    entrar(ids["usuario_a"], "familia")
    assert client.get(f"/comunicaciones/familia/{c['id']}").json()["tipo"] == tipo


def test_gestion_no_puede_crear_curso_ni_tipo_desconocido(client, escenario):
    ids, _ = escenario
    for tipo in ("curso", "desconocido"):
        assert client.post("/comunicaciones", json=datos(ids, tipo=tipo)).status_code == 422


def test_listas_destinatarios_paginan_buscan_y_filtran_enviados(client, escenario, db_session):
    from src.comunicaciones.models import ReciboComunicacion
    from src.familias_alumnos.models import Familia
    from src.models import Persona
    from src.workflows.models import EnvioNotificacion

    ids, entrar = escenario
    c = crear(client, ids)
    assert client.post(f"/comunicaciones/{c['id']}/publicar").status_code == 200
    for indice in range(11):
        persona = Persona(nombre=f"Persona{indice:02}", apellido="Prueba", dni=f"9500{indice:04}")
        db_session.add(persona)
        db_session.flush()
        familia = Familia(persona_id=persona.id)
        db_session.add(familia)
        db_session.flush()
        db_session.add(
            ReciboComunicacion(
                comunicacion_id=uuid.UUID(c["id"]), familia_id=familia.id, alumnos=[]
            )
        )
        db_session.add(
            EnvioNotificacion(
                comunicacion_id=uuid.UUID(c["id"]),
                familia_id=familia.id,
                email=f"p{indice}@example.test",
                asunto="Prueba",
                cuerpo="Prueba",
                estado="presentado" if indice < 10 else "fallido",
            )
        )
    persona = Persona(nombre="Ana", apellido="Gómez", dni="96000000")
    db_session.add(persona)
    db_session.flush()
    familia = Familia(persona_id=persona.id)
    db_session.add(familia)
    db_session.flush()
    db_session.add(
        ReciboComunicacion(comunicacion_id=uuid.UUID(c["id"]), familia_id=familia.id, alumnos=[])
    )
    db_session.commit()
    ruta = f"/comunicaciones/{c['id']}/destinatarios"
    primera = client.get(ruta)
    assert primera.status_code == 200
    assert primera.headers["cache-control"] == "private, no-store"
    assert primera.json()["total"] == 13
    assert primera.json()["total_paginas"] == 2
    assert len(primera.json()["items"]) == 10
    segunda = client.get(ruta, params={"pagina": 2}).json()
    assert len(segunda["items"]) == 3
    assert {r["id"] for r in primera.json()["items"]}.isdisjoint(r["id"] for r in segunda["items"])
    assert client.get(ruta, params={"buscar": "Persona10"}).json()["total"] == 1
    for buscar in ("gomez", "GÓMEZ"):
        encontrados = client.get(ruta, params={"buscar": buscar}).json()
        assert encontrados["total"] == 1
        assert encontrados["items"][0]["nombre"] == "Ana Gómez"
    enviados = client.get(ruta, params={"vista": "enviados"}).json()
    assert enviados["total"] == 10
    assert all(r["estado"] == "presentado" for r in enviados["items"])
    assert client.get(ruta, params={"vista": "envios"}).json()["total"] == 11
    assert (
        client.get(ruta, params={"vista": "enviados", "buscar": "Persona10"}).json()["total"] == 0
    )
    assert client.get(ruta, params={"pagina": 0}).status_code == 422
    assert client.get(ruta, params={"vista": "desconocida"}).status_code == 422
    entrar(ids["usuario_a"], "familia")
    assert client.get(ruta).status_code == 403


def test_borrador_publicacion_y_lectura_persistida(client, escenario, db_session):
    ids, entrar = escenario
    borrador = crear(client, ids)
    entrar(ids["usuario_a"], "familia")
    assert client.get("/comunicaciones/familia").json()["total"] == 0
    assert client.get(f"/comunicaciones/familia/{borrador['id']}").status_code == 404
    entrar()
    publicada = client.post(f"/comunicaciones/{borrador['id']}/publicar")
    assert publicada.status_code == 200, publicada.text
    assert publicada.json()["destinatarios"] == 1
    assert client.post(f"/comunicaciones/{borrador['id']}/publicar").json() == publicada.json()
    entrar(ids["usuario_a"], "familia")
    detalle = client.get(f"/comunicaciones/familia/{borrador['id']}")
    assert detalle.json()["leida_at"] is None
    assert detalle.json()["cuerpo"] == borrador["cuerpo"]
    lectura = client.put(f"/comunicaciones/familia/{borrador['id']}/lectura")
    assert lectura.status_code == 200
    assert lectura.json()["leida_at"]
    assert client.put(f"/comunicaciones/familia/{borrador['id']}/lectura").json() == lectura.json()
    db_session.expire_all()
    assert client.get("/comunicaciones/familia").json()["items"][0]["leida_at"]
    assert db_session.scalars(select(AuditLog).where(AuditLog.entidad == "comunicacion")).all()


def test_ajenos_y_vinculos_revocados_no_acceden(client, escenario, db_session):
    ids, entrar = escenario
    borrador = crear(
        client, ids, audiencia={"tipo": "responsables", "ids": [str(ids["familia_b"])]}
    )
    assert client.post(f"/comunicaciones/{borrador['id']}/publicar").status_code == 200
    entrar(ids["usuario_a"], "familia")
    antes = snapshot(db_session)
    assert client.get(f"/comunicaciones/familia/{borrador['id']}").status_code == 404
    assert client.put(f"/comunicaciones/familia/{borrador['id']}/lectura").status_code == 404
    assert snapshot(db_session) == antes
    entrar()
    propia = crear(client, ids)
    client.post(f"/comunicaciones/{propia['id']}/publicar")
    vinculo = db_session.get(FamiliaAlumno, ids["vinculo_a"])
    vinculo.recibe_comunicaciones = False
    db_session.commit()
    entrar(ids["usuario_a"], "familia")
    assert client.get("/comunicaciones/familia").json()["total"] == 0
    assert client.get(f"/comunicaciones/familia/{propia['id']}").status_code == 404


def test_deduplica_vinculos_y_lectura_individual(client, escenario, db_session):
    ids, entrar = escenario
    db_session.add(
        FamiliaAlumno(
            familia_id=ids["familia_a"], alumno_id=ids["alumno_b"], recibe_comunicaciones=True
        )
    )
    db_session.commit()
    borrador = crear(client, ids, audiencia={"tipo": "todos", "ids": []})
    assert client.post(f"/comunicaciones/{borrador['id']}/publicar").json()["destinatarios"] == 2
    entrar(ids["usuario_a"], "familia")
    assert client.get("/comunicaciones/familia").json()["total"] == 1
    assert client.put(f"/comunicaciones/familia/{borrador['id']}/lectura").status_code == 200
    rol = db_session.scalar(select(Rol).where(Rol.codigo == "familia"))
    db_session.add(UsuarioRol(usuario_id=ids["usuario_otro"], rol_id=rol.id))
    db_session.commit()
    entrar(ids["usuario_otro"], "familia")
    assert client.get(f"/comunicaciones/familia/{borrador['id']}").json()["leida_at"] is None


def test_borrador_editable_publicacion_inmutable_y_clave(client, escenario, db_session):
    ids, entrar = escenario
    body = datos(ids)
    original = client.post("/comunicaciones", json=body).json()
    assert client.post("/comunicaciones", json=body).json()["id"] == original["id"]
    assert client.post("/comunicaciones", json={**body, "asunto": "Otro"}).status_code == 409
    editada = client.put(
        f"/comunicaciones/{original['id']}", json={**body, "asunto": "Actualizado"}
    )
    assert editada.status_code == 200
    assert editada.json()["asunto"] == "Actualizado"
    assert client.post(f"/comunicaciones/{original['id']}/publicar").status_code == 200
    antes = snapshot(db_session)
    assert client.put(f"/comunicaciones/{original['id']}", json=body).status_code == 409
    assert snapshot(db_session) == antes
    entrar(rol="docente")
    assert client.post("/comunicaciones", json=datos(ids)).status_code == 403
    assert client.get("/comunicaciones").status_code == 403
    entrar(ids["usuario_a"], "familia")
    assert client.post("/comunicaciones", json=datos(ids)).status_code == 403
    assert client.get("/comunicaciones").status_code == 403


def test_revalida_audiencia_y_no_publica_sin_destinatarios(client, escenario, db_session):
    ids, _ = escenario
    borrador = crear(
        client, ids, audiencia={"tipo": "responsables", "ids": [str(ids["familia_c"])]}
    )
    antes = snapshot(db_session)
    assert client.post(f"/comunicaciones/{borrador['id']}/publicar").status_code == 422
    assert snapshot(db_session) == antes
    preview = client.post("/comunicaciones/vista-previa", json=datos(ids))
    assert preview.status_code == 200
    assert preview.json()["destinatarios"] == 1
    assert client.get("/comunicaciones/opciones").status_code == 200


@pytest.mark.parametrize("tipo,campo", [("division", "division"), ("nivel", "nivel")])
def test_audiencia_academica_respeta_ciclo(client, escenario, tipo, campo):
    ids, _ = escenario
    for ciclo, esperado in (("2027", 2), ("2026", 0)):
        preview = client.post(
            "/comunicaciones/vista-previa",
            json=datos(
                ids, audiencia={"tipo": tipo, "ids": [str(ids[campo])], "ciclo_lectivo": ciclo}
            ),
        )
        assert preview.status_code == 200
        assert preview.json()["destinatarios"] == esperado


def test_otro_autor_no_puede_editar_ni_publicar_borrador(client, escenario, db_session):
    ids, entrar = escenario
    borrador = crear(client, ids)
    rol = db_session.scalar(select(Rol).where(Rol.codigo == "administracion"))
    db_session.add(UsuarioRol(usuario_id=ids["usuario_otro"], rol_id=rol.id))
    db_session.commit()
    entrar(ids["usuario_otro"])
    antes = snapshot(db_session)
    assert client.get(f"/comunicaciones/{borrador['id']}").status_code == 404
    assert client.put(f"/comunicaciones/{borrador['id']}", json=datos(ids)).status_code == 404
    assert client.post(f"/comunicaciones/{borrador['id']}/publicar").status_code == 404
    assert snapshot(db_session) == antes


@pytest.mark.parametrize(
    "cambio",
    [
        {"asunto": "  "},
        {"cuerpo": ""},
        {"audiencia": {"tipo": "alumnos", "ids": []}},
        {"audiencia": {"tipo": "division", "ids": [str(uuid.uuid4())]}},
    ],
)
def test_validacion_no_persiste_datos(client, escenario, db_session, cambio):
    ids, _ = escenario
    antes = snapshot(db_session)
    assert client.post("/comunicaciones", json=datos(ids, **cambio)).status_code == 422
    assert snapshot(db_session) == antes


def test_usuario_sin_sesion_no_accede(client):
    assert client.get("/comunicaciones").status_code == 401
    assert client.get("/comunicaciones/familia").status_code == 401


def test_mensaje_de_familia_en_endpoints_administrativos_no_cambia(client, escenario):
    ids, entrar = escenario
    entrar(ids["usuario_a"], "familia")
    respuesta = client.get("/comunicaciones")
    assert respuesta.status_code == 403
    assert respuesta.json()["detail"] == "Usá tu bandeja familiar"


def test_administrador_del_sistema_cubre_todos_los_modulos_y_publica(client, escenario, db_session):
    import runpy
    from pathlib import Path

    import yaml

    ids, entrar = escenario
    seeds = Path(__file__).resolve().parents[3] / "database" / "seeds"
    entries = yaml.safe_load((seeds / "grupo-b.yaml").read_text())["permiso"]
    system_entries = [e for e in entries if e["rol"] == "administrador del sistema"]
    assert {e["modulo"] for e in entries} <= {e["modulo"] for e in system_entries}
    role = Rol(nombre="administrador del sistema")
    db_session.add(role)
    db_session.flush()
    db_session.add(UsuarioRol(usuario_id=ids["usuario_otro"], rol_id=role.id))
    seed = runpy.run_path(str(seeds / "03_seed_grupo_b.py"))["seed_permiso"]
    seed(db_session, {"permiso": system_entries})
    db_session.flush()
    count = len(db_session.scalars(select(RolPermiso).where(RolPermiso.rol_id == role.id)).all())
    seed(db_session, {"permiso": system_entries})
    db_session.commit()
    assert (
        len(db_session.scalars(select(RolPermiso).where(RolPermiso.rol_id == role.id)).all())
        == count
    )
    entrar(ids["usuario_otro"], "administrador_del_sistema")
    assert client.get("/comunicaciones").status_code == 200
    assert client.get("/comunicaciones/opciones").status_code == 200
    draft = crear(client, ids)
    assert client.get(f"/comunicaciones/{draft['id']}").status_code == 200
    assert (
        client.put(
            f"/comunicaciones/{draft['id']}", json=datos(ids, clave=draft["clave"])
        ).status_code
        == 200
    )
    assert client.post("/comunicaciones/vista-previa", json=datos(ids)).status_code == 200
    assert client.post(f"/comunicaciones/{draft['id']}/publicar").status_code == 200
