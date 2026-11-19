"""Sesión con refresh token: login, rotación, reuso, vencimientos y revocación."""

from datetime import timedelta

from sqlalchemy import select

from src.auth import config
from src.auth.constants import MODULO_AUTENTICACION
from src.auth.models import Sesion, UsuarioRol
from src.auth.refresh_service import hashear_token
from src.fechas import ahora_utc
from tests.auth.conftest import PASSWORD_VALIDA


def _login(client, usuario):
    respuesta = client.post(
        "/auth/login", json={"email": usuario.email, "password": PASSWORD_VALIDA}
    )
    assert respuesta.status_code == 200
    return respuesta


def _refresh_actual(client):
    return client.cookies.get(config.COOKIE_REFRESH)


def _poner_refresh(client, token):
    client.cookies.set(config.COOKIE_REFRESH, token, path="/auth")


def _sesiones(db_session):
    db_session.expire_all()
    return list(db_session.scalars(select(Sesion).order_by(Sesion.creada_en)))


def _con_un_rol(db_session, usuario, rol_con_permisos, nombre="admin de prueba"):
    rol = rol_con_permisos(nombre, [(MODULO_AUTENTICACION, "leer")])
    db_session.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol.id))
    db_session.commit()
    return rol


def test_login_setea_las_dos_cookies_y_crea_la_sesion(client, db_session, usuario_local):
    respuesta = _login(client, usuario_local)

    assert config.COOKIE_SESION in respuesta.cookies
    assert config.COOKIE_REFRESH in respuesta.cookies
    (sesion,) = _sesiones(db_session)
    assert sesion.usuario_id == usuario_local.id
    assert sesion.token_hash == hashear_token(_refresh_actual(client))
    assert sesion.token_hash != _refresh_actual(client)
    assert sesion.expira_absoluta_en - sesion.creada_en == config.REFRESH_TOKEN_MAX


def test_refresh_rota_el_token_y_conserva_el_rol(
    client, db_session, usuario_local, rol_con_permisos
):
    rol = _con_un_rol(db_session, usuario_local, rol_con_permisos)
    _login(client, usuario_local)
    viejo = _refresh_actual(client)

    respuesta = client.post("/auth/refresh")

    assert respuesta.status_code == 200
    assert _refresh_actual(client) != viejo
    assert client.get("/auth/me").json()["rol_activo"] == rol.codigo
    anterior, nueva = _sesiones(db_session)
    assert anterior.reemplazada_en is not None
    assert nueva.familia_id == anterior.familia_id
    assert nueva.expira_absoluta_en == anterior.expira_absoluta_en


def test_refresh_conserva_el_rol_elegido_con_rol_activo(
    client, db_session, usuario_local, rol_con_permisos
):
    rol_a = _con_un_rol(db_session, usuario_local, rol_con_permisos, "rol a")
    rol_b = _con_un_rol(db_session, usuario_local, rol_con_permisos, "rol b")
    _login(client, usuario_local)
    assert client.post("/auth/rol-activo", json={"rol": rol_b.codigo}).status_code == 200

    assert client.post("/auth/refresh").status_code == 200

    assert client.get("/auth/me").json()["rol_activo"] == rol_b.codigo
    assert rol_a.codigo != rol_b.codigo


def test_refresh_sin_cookie_da_401(client):
    assert client.post("/auth/refresh").status_code == 401


def test_refresh_con_token_inexistente_da_401_y_borra_las_cookies(client, usuario_local):
    _poner_refresh(client, "no-existe")

    respuesta = client.post("/auth/refresh")

    assert respuesta.status_code == 401
    assert "max-age=0" in "".join(respuesta.headers.get_list("set-cookie")).lower()


def test_reuso_dentro_de_la_gracia_solo_emite_access(client, db_session, usuario_local):
    _login(client, usuario_local)
    viejo = _refresh_actual(client)
    assert client.post("/auth/refresh").status_code == 200
    nuevo = _refresh_actual(client)

    _poner_refresh(client, viejo)
    respuesta = client.post("/auth/refresh")

    assert respuesta.status_code == 200
    assert config.COOKIE_SESION in respuesta.cookies
    assert config.COOKIE_REFRESH not in respuesta.cookies
    assert all(s.revocada_en is None for s in _sesiones(db_session))
    _poner_refresh(client, nuevo)
    assert client.post("/auth/refresh").status_code == 200


def test_reuso_fuera_de_la_gracia_revoca_la_familia(client, db_session, usuario_local):
    _login(client, usuario_local)
    viejo = _refresh_actual(client)
    assert client.post("/auth/refresh").status_code == 200
    nuevo = _refresh_actual(client)
    anterior = _sesiones(db_session)[0]
    anterior.reemplazada_en = ahora_utc() - config.REFRESH_GRACIA - timedelta(seconds=5)
    db_session.commit()

    _poner_refresh(client, viejo)
    assert client.post("/auth/refresh").status_code == 401

    assert all(s.revocada_en is not None for s in _sesiones(db_session))
    _poner_refresh(client, nuevo)
    assert client.post("/auth/refresh").status_code == 401


def test_vence_por_inactividad(client, db_session, usuario_local):
    _login(client, usuario_local)
    (sesion,) = _sesiones(db_session)
    sesion.expira_en = ahora_utc() - timedelta(seconds=1)
    db_session.commit()

    assert client.post("/auth/refresh").status_code == 401


def test_vence_por_tope_absoluto(client, db_session, usuario_local):
    _login(client, usuario_local)
    (sesion,) = _sesiones(db_session)
    sesion.expira_absoluta_en = ahora_utc() - timedelta(seconds=1)
    db_session.commit()

    assert client.post("/auth/refresh").status_code == 401


def test_la_rotacion_no_pasa_del_tope_absoluto(client, db_session, usuario_local):
    _login(client, usuario_local)
    (sesion,) = _sesiones(db_session)
    sesion.expira_absoluta_en = ahora_utc() + timedelta(days=1)
    db_session.commit()

    assert client.post("/auth/refresh").status_code == 200

    nueva = _sesiones(db_session)[-1]
    assert nueva.expira_en == nueva.expira_absoluta_en


def test_logout_revoca_la_sesion(client, db_session, usuario_local):
    _login(client, usuario_local)
    refresh = _refresh_actual(client)

    assert client.post("/auth/logout").status_code == 200

    assert all(s.revocada_en is not None for s in _sesiones(db_session))
    _poner_refresh(client, refresh)
    assert client.post("/auth/refresh").status_code == 401


def test_dar_de_baja_revoca_todas_las_sesiones(client_admin, db_session, usuario_google):
    sesion = Sesion(
        usuario_id=usuario_google.id,
        familia_id=usuario_google.id,
        token_hash=hashear_token("x"),
        creada_en=ahora_utc(),
        expira_en=ahora_utc() + timedelta(days=1),
        expira_absoluta_en=ahora_utc() + timedelta(days=2),
    )
    db_session.add(sesion)
    db_session.commit()

    respuesta = client_admin.put(
        f"/auth/usuarios/{usuario_google.id}/estado", json={"estado": "inactivo"}
    )

    assert respuesta.status_code == 204
    db_session.refresh(sesion)
    assert sesion.revocada_en is not None


def test_cambiar_la_contrasenia_revoca_las_sesiones(client_admin, db_session, usuario_google):
    sesion = Sesion(
        usuario_id=usuario_google.id,
        familia_id=usuario_google.id,
        token_hash=hashear_token("y"),
        creada_en=ahora_utc(),
        expira_en=ahora_utc() + timedelta(days=1),
        expira_absoluta_en=ahora_utc() + timedelta(days=2),
    )
    db_session.add(sesion)
    db_session.commit()

    respuesta = client_admin.put(
        f"/auth/usuarios/{usuario_google.id}/acceso",
        json={"metodo": "local", "password": "otra-contrasenia-larga"},
    )

    assert respuesta.status_code == 204
    db_session.refresh(sesion)
    assert sesion.revocada_en is not None


def test_usuario_inactivo_no_refresca(client, db_session, usuario_local):
    _login(client, usuario_local)
    usuario_local.estado = "inactivo"
    db_session.commit()

    assert client.post("/auth/refresh").status_code == 401


def test_login_borra_las_sesiones_vencidas_del_usuario(client, db_session, usuario_local):
    _login(client, usuario_local)
    (vieja,) = _sesiones(db_session)
    vieja.expira_en = ahora_utc() - timedelta(days=1)
    db_session.commit()
    vieja_id = vieja.id

    _login(client, usuario_local)

    assert vieja_id not in {s.id for s in _sesiones(db_session)}


def test_eliminar_un_usuario_borra_sus_sesiones(client_admin, db_session, usuario_google):
    db_session.add(
        Sesion(
            usuario_id=usuario_google.id,
            familia_id=usuario_google.id,
            token_hash=hashear_token("z"),
            creada_en=ahora_utc(),
            expira_en=ahora_utc() + timedelta(days=1),
            expira_absoluta_en=ahora_utc() + timedelta(days=2),
        )
    )
    db_session.commit()

    respuesta = client_admin.delete(f"/auth/usuarios/{usuario_google.id}")

    assert respuesta.status_code == 204
    assert not [s for s in _sesiones(db_session) if s.usuario_id == usuario_google.id]
