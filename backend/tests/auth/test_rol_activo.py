"""Autorización por ROL ACTIVO, no por la suma de roles de la cuenta (RF-30).

Antes de esto, `requiere_permiso` sumaba todos los roles de la cuenta: una cuenta con
`docente` + `administración`, aunque el frontend mostrara solo la pantalla de docente, tenía
a nivel API todos los permisos de administración. Este archivo cubre el mecanismo nuevo: el
rol activo viaja como claim `rol` en el JWT de sesión, se fija con `POST /auth/rol-activo`, y
`requiere_permiso` autoriza solo contra ese rol.
"""

from src.auth.constants import MODULO_ACADEMICO, MODULO_AUTENTICACION, codigo_de
from src.auth.models import Rol, RolPermiso, UsuarioRol
from tests.auth.conftest import PASSWORD_VALIDA

ACADEMICO_ACTUALIZAR_ESTRUCTURA = codigo_de(MODULO_ACADEMICO, "actualizar", "estructura")


def login(client, usuario):
    return client.post("/auth/login", json={"email": usuario.email, "password": PASSWORD_VALIDA})


def test_login_con_un_solo_rol_ya_lo_deja_activo(
    client, db_session, usuario_local, rol_con_permisos
):
    """Retrocompatible con la mayoría de los fixtures existentes: nadie tiene que llamar a
    `/auth/rol-activo` a mano si la cuenta tiene un único rol."""
    rol = rol_con_permisos("admin de prueba", [(MODULO_AUTENTICACION, "leer")])
    db_session.add(UsuarioRol(usuario_id=usuario_local.id, rol_id=rol.id))
    db_session.commit()
    login(client, usuario_local)

    respuesta = client.get("/auth/me")

    assert respuesta.status_code == 200
    assert respuesta.json()["rol_activo"] == rol.codigo
    assert client.get("/auth/roles").status_code == 200


def test_login_sin_roles_arranca_sin_rol_activo_y_deniega(client, usuario_local):
    login(client, usuario_local)

    respuesta = client.get("/auth/me")

    assert respuesta.status_code == 200
    assert respuesta.json()["rol_activo"] is None
    assert client.get("/auth/roles").status_code == 403


def test_login_con_dos_roles_arranca_sin_rol_activo_y_deniega(
    client, db_session, usuario_local, rol_con_permisos
):
    rol_a = rol_con_permisos("rol a", [(MODULO_AUTENTICACION, "leer")])
    rol_b = rol_con_permisos("rol b", [(MODULO_ACADEMICO, "leer")])
    db_session.add(UsuarioRol(usuario_id=usuario_local.id, rol_id=rol_a.id))
    db_session.add(UsuarioRol(usuario_id=usuario_local.id, rol_id=rol_b.id))
    db_session.commit()
    login(client, usuario_local)

    respuesta = client.get("/auth/me")

    assert respuesta.status_code == 200
    assert respuesta.json()["rol_activo"] is None
    assert client.get("/auth/roles").status_code == 403


def test_elegir_rol_activo_habilita_el_endpoint_de_ese_rol(
    client, db_session, usuario_local, rol_con_permisos
):
    rol_sin_permiso = rol_con_permisos("sin acceso", [(MODULO_ACADEMICO, "leer")])
    rol_con_permiso = rol_con_permisos("con acceso", [(MODULO_AUTENTICACION, "leer")])
    db_session.add(UsuarioRol(usuario_id=usuario_local.id, rol_id=rol_sin_permiso.id))
    db_session.add(UsuarioRol(usuario_id=usuario_local.id, rol_id=rol_con_permiso.id))
    db_session.commit()
    login(client, usuario_local)
    assert client.get("/auth/roles").status_code == 403

    respuesta = client.post("/auth/rol-activo", json={"rol": rol_con_permiso.codigo})

    assert respuesta.status_code == 200
    assert client.get("/auth/roles").status_code == 200
    assert client.get("/auth/me").json()["rol_activo"] == rol_con_permiso.codigo


def test_rol_activo_con_rol_que_la_cuenta_no_tiene_da_403(client, usuario_local):
    login(client, usuario_local)

    respuesta = client.post("/auth/rol-activo", json={"rol": "rol inexistente"})

    assert respuesta.status_code == 403


def test_cambiar_a_un_rol_sin_el_permiso_vuelve_a_denegar(
    client, db_session, usuario_local, rol_con_permisos
):
    """El caso que motivó todo esto: con docente activo, administración no se hereda."""
    rol_docente = rol_con_permisos("docente de prueba", [(MODULO_ACADEMICO, "leer")])
    rol_admin = rol_con_permisos("administración de prueba", [(MODULO_AUTENTICACION, "leer")])
    db_session.add(UsuarioRol(usuario_id=usuario_local.id, rol_id=rol_docente.id))
    db_session.add(UsuarioRol(usuario_id=usuario_local.id, rol_id=rol_admin.id))
    db_session.commit()
    login(client, usuario_local)

    client.post("/auth/rol-activo", json={"rol": rol_docente.codigo})
    assert client.get("/auth/roles").status_code == 403

    client.post("/auth/rol-activo", json={"rol": rol_admin.codigo})
    assert client.get("/auth/roles").status_code == 200


def test_me_con_rol_de_cookie_ya_no_valido_devuelve_rol_activo_null(
    client, db_session, usuario_local, rol_con_permisos
):
    rol = rol_con_permisos("rol temporal", [(MODULO_AUTENTICACION, "leer")])
    db_session.add(UsuarioRol(usuario_id=usuario_local.id, rol_id=rol.id))
    db_session.commit()
    login(client, usuario_local)
    assert client.get("/auth/me").json()["rol_activo"] == rol.codigo

    db_session.query(RolPermiso).filter(RolPermiso.rol_id == rol.id).delete()
    db_session.query(UsuarioRol).filter(UsuarioRol.rol_id == rol.id).delete()
    db_session.delete(db_session.get(Rol, rol.id))
    db_session.commit()

    respuesta = client.get("/auth/me")
    assert respuesta.json()["rol_activo"] is None
