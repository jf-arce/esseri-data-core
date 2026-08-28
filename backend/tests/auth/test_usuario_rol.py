"""USUARIO_ROL (RF-29): asignar/quitar roles de un usuario, vía HTTP con `client_admin`."""

from src.auth.constants import (
    ACCION_ACTUALIZAR,
    ACCION_LEER,
    MODULO_ACADEMICO,
    MODULO_AUTENTICACION,
)
from src.auth.models import UsuarioRol
from tests.auth.conftest import PASSWORD_VALIDA


def login(client, usuario):
    return client.post("/auth/login", json={"email": usuario.email, "password": PASSWORD_VALIDA})


class TestAsignarYQuitarRol:
    def test_asignar_rol_a_usuario(self, client_admin, usuario_google):
        rol_id = client_admin.post("/auth/roles", json={"nombre": "docente"}).json()["id"]

        respuesta = client_admin.post(
            f"/auth/usuarios/{usuario_google.id}/roles", json={"rol_id": rol_id}
        )

        assert respuesta.status_code == 204
        roles = client_admin.get(f"/auth/usuarios/{usuario_google.id}/roles").json()
        assert [r["id"] for r in roles] == [rol_id]

    def test_asignar_rol_dos_veces_es_idempotente(self, client_admin, usuario_google):
        rol_id = client_admin.post("/auth/roles", json={"nombre": "docente"}).json()["id"]

        client_admin.post(f"/auth/usuarios/{usuario_google.id}/roles", json={"rol_id": rol_id})
        client_admin.post(f"/auth/usuarios/{usuario_google.id}/roles", json={"rol_id": rol_id})

        roles = client_admin.get(f"/auth/usuarios/{usuario_google.id}/roles").json()
        assert len(roles) == 1

    def test_quitar_rol_a_usuario(self, client_admin, usuario_google):
        rol_id = client_admin.post("/auth/roles", json={"nombre": "docente"}).json()["id"]
        client_admin.post(f"/auth/usuarios/{usuario_google.id}/roles", json={"rol_id": rol_id})

        respuesta = client_admin.delete(f"/auth/usuarios/{usuario_google.id}/roles/{rol_id}")

        assert respuesta.status_code == 204
        assert client_admin.get(f"/auth/usuarios/{usuario_google.id}/roles").json() == []

    def test_usuario_puede_tener_dos_roles_simultaneos(
        self, client_admin, db_session, usuario_local
    ):
        """Confirmado por el cliente: docente que también es familia, una sola cuenta."""
        docente_id = client_admin.post("/auth/roles", json={"nombre": "docente"}).json()["id"]
        familia_id = client_admin.post("/auth/roles", json={"nombre": "familia"}).json()["id"]
        client_admin.post(f"/auth/usuarios/{usuario_local.id}/roles", json={"rol_id": docente_id})
        client_admin.post(f"/auth/usuarios/{usuario_local.id}/roles", json={"rol_id": familia_id})

        login(client_admin, usuario_local)
        roles = client_admin.get("/auth/me").json()["roles"]

        assert set(roles) >= {"docente", "familia"}


class TestAntiLockout:
    def test_no_se_puede_quitar_el_ultimo_rol_que_administra_permisos(
        self, client_admin, db_session, usuario_local
    ):
        """Sin este guard, el admin se quita su propio rol y nadie más puede reasignar
        permisos — irrecuperable sin entrar a la base a mano."""
        roles = client_admin.get(f"/auth/usuarios/{usuario_local.id}/roles").json()
        rol_admin_id = roles[0]["id"]

        respuesta = client_admin.delete(f"/auth/usuarios/{usuario_local.id}/roles/{rol_admin_id}")

        assert respuesta.status_code == 409

    def test_se_puede_quitar_si_otro_usuario_conserva_el_permiso(
        self, client_admin, db_session, usuario_local, usuario_google, rol_con_permisos
    ):
        rol_admin_id = client_admin.get(f"/auth/usuarios/{usuario_local.id}/roles").json()[0]["id"]
        otro_rol_admin = rol_con_permisos("otro admin", [(MODULO_AUTENTICACION, ACCION_ACTUALIZAR)])
        db_session.add(UsuarioRol(usuario_id=usuario_google.id, rol_id=otro_rol_admin.id))
        db_session.commit()

        respuesta = client_admin.delete(f"/auth/usuarios/{usuario_local.id}/roles/{rol_admin_id}")

        assert respuesta.status_code == 204

    def test_se_puede_quitar_si_el_usuario_conserva_el_permiso_por_otro_rol(
        self, client_admin, db_session, usuario_local, rol_con_permisos
    ):
        rol_admin_id = client_admin.get(f"/auth/usuarios/{usuario_local.id}/roles").json()[0]["id"]
        segundo_rol = rol_con_permisos("segundo admin", [(MODULO_AUTENTICACION, ACCION_ACTUALIZAR)])
        db_session.add(UsuarioRol(usuario_id=usuario_local.id, rol_id=segundo_rol.id))
        db_session.commit()

        respuesta = client_admin.delete(f"/auth/usuarios/{usuario_local.id}/roles/{rol_admin_id}")

        assert respuesta.status_code == 204

    def test_quitar_un_rol_sin_permiso_de_autenticacion_no_dispara_el_guard(
        self, client_admin, db_session, usuario_local, rol_con_permisos
    ):
        rol_academico = rol_con_permisos("docente de prueba", [(MODULO_ACADEMICO, ACCION_LEER)])
        db_session.add(UsuarioRol(usuario_id=usuario_local.id, rol_id=rol_academico.id))
        db_session.commit()

        respuesta = client_admin.delete(
            f"/auth/usuarios/{usuario_local.id}/roles/{rol_academico.id}"
        )

        assert respuesta.status_code == 204
