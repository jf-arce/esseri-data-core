"""get_current_user y GET /auth/me: la puerta que van a usar los otros módulos."""

import uuid
from datetime import UTC, datetime, timedelta

from jose import jwt

from src.auth import config, sesion_service
from src.models import Persona
from tests.auth.conftest import PASSWORD_VALIDA


def login(client, usuario):
    return client.post("/auth/login", json={"email": usuario.email, "password": PASSWORD_VALIDA})


def test_me_sin_cookie_rechaza(client):
    assert client.get("/auth/me").status_code == 401


def test_me_con_token_invalido_rechaza(client):
    client.cookies.set(config.COOKIE_SESION, "no-es-un-jwt")
    assert client.get("/auth/me").status_code == 401


def test_me_con_token_expirado_rechaza(client, usuario_local):
    vencido = jwt.encode(
        {"sub": str(usuario_local.id), "exp": datetime.now(UTC) - timedelta(minutes=1)},
        config.JWT_SECRET,
        algorithm=config.JWT_ALGORITHM,
    )
    client.cookies.set(config.COOKIE_SESION, vencido)
    assert client.get("/auth/me").status_code == 401


def test_me_con_usuario_borrado_rechaza(client):
    client.cookies.set(config.COOKIE_SESION, sesion_service.crear_access_token(uuid.uuid4()))
    assert client.get("/auth/me").status_code == 401


def test_me_devuelve_el_usuario_y_sus_roles(client, db_session, usuario_local, con_rol):
    con_rol(usuario_local)
    login(client, usuario_local)

    cuerpo = client.get("/auth/me").json()

    assert cuerpo["email"] == usuario_local.email
    assert cuerpo["estado"] == "activo"
    assert cuerpo["roles"] == ["administrador del sistema"]


def test_me_sin_roles_devuelve_lista_vacia(client, usuario_local):
    """Un usuario recién cargado, antes de que le asignen rol, igual se autentica."""
    login(client, usuario_local)
    assert client.get("/auth/me").json()["roles"] == []


def test_me_perfiles_desglosa_permisos_por_rol(db_session, client, usuario_local, rol_con_permisos):
    """`perfiles` (a diferencia de `permisos`, la suma) trae los permisos propios de cada rol
    por separado — es lo que alimenta la pantalla "¿Cómo querés entrar?" del frontend."""
    from src.auth.constants import ACCION_LEER, MODULO_ACADEMICO, MODULO_INSCRIPCIONES
    from src.auth.models import UsuarioRol

    rol_docente = rol_con_permisos("docente", [(MODULO_ACADEMICO, ACCION_LEER)])
    rol_familia = rol_con_permisos("familia", [(MODULO_INSCRIPCIONES, ACCION_LEER)])
    db_session.add_all(
        [
            UsuarioRol(usuario_id=usuario_local.id, rol_id=rol_docente.id),
            UsuarioRol(usuario_id=usuario_local.id, rol_id=rol_familia.id),
        ]
    )
    db_session.commit()
    login(client, usuario_local)

    perfiles = client.get("/auth/me").json()["perfiles"]

    assert [p["nombre"] for p in perfiles] == ["docente", "familia"]
    assert [p["accion"] for p in perfiles[0]["permisos"]] == [ACCION_LEER]
    assert [p["accion"] for p in perfiles[1]["permisos"]] == [ACCION_LEER]
    assert perfiles[0]["permisos"][0]["modulo"] == MODULO_ACADEMICO
    # No es la suma: el perfil "docente" no ve el permiso de Inscripciones del otro rol.
    assert not any(perm["modulo"] == MODULO_INSCRIPCIONES for perm in perfiles[0]["permisos"])


def test_dar_de_baja_corta_la_sesion_sin_esperar_al_vencimiento(client, db_session, usuario_local):
    login(client, usuario_local)
    assert client.get("/auth/me").status_code == 200

    usuario_local.estado = "inactivo"
    db_session.commit()

    assert client.get("/auth/me").status_code == 403


def test_logout_borra_la_cookie(client, usuario_local):
    login(client, usuario_local)
    assert client.get("/auth/me").status_code == 200

    client.post("/auth/logout")

    assert client.get("/auth/me").status_code == 401


def test_me_sin_datos_de_google_ni_persona_devuelve_null(client, usuario_local):
    login(client, usuario_local)

    cuerpo = client.get("/auth/me").json()

    assert cuerpo["nombre_google"] is None
    assert cuerpo["avatar_url"] is None
    assert cuerpo["persona_nombre"] is None
    assert cuerpo["persona_apellido"] is None


def test_me_devuelve_nombre_y_foto_de_google(
    client, usuario_google, google_responde, iniciar_flujo_google
):
    google_responde(
        usuario_google.email,
        usuario_google.provider_subject,
        nombre="Ana Pérez",
        foto_url="https://lh3.googleusercontent.com/a",
    )
    state = iniciar_flujo_google()
    client.get(f"/auth/google/callback?code=abc&state={state}", follow_redirects=False)

    cuerpo = client.get("/auth/me").json()

    assert cuerpo["nombre_google"] == "Ana Pérez"
    assert cuerpo["avatar_url"] == "https://lh3.googleusercontent.com/a"


def test_me_con_persona_devuelve_nombre_y_apellido(client, db_session, usuario_local):
    persona = Persona(nombre="Julieta", apellido="Amaya", dni="40222333")
    db_session.add(persona)
    db_session.flush()
    usuario_local.persona_id = persona.id
    db_session.commit()
    login(client, usuario_local)

    cuerpo = client.get("/auth/me").json()

    assert cuerpo["persona_nombre"] == "Julieta"
    assert cuerpo["persona_apellido"] == "Amaya"
