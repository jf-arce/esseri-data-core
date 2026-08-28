"""Autorización por permisos (RF-30): el núcleo es `service.tiene_permiso`."""

from src.auth import service
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


class TestTienePermiso:
    def test_usuario_sin_roles_no_tiene_ningun_permiso(self, db_session, usuario_local):
        assert not service.tiene_permiso(
            db_session, usuario_local.id, MODULO_ACADEMICO, ACCION_LEER
        )

    def test_permiso_exacto_habilita(self, db_session, usuario_local, rol_con_permisos):
        rol = rol_con_permisos("docente de prueba", [(MODULO_ACADEMICO, ACCION_LEER)])
        db_session.add(UsuarioRol(usuario_id=usuario_local.id, rol_id=rol.id))
        db_session.commit()

        assert service.tiene_permiso(db_session, usuario_local.id, MODULO_ACADEMICO, ACCION_LEER)

    def test_otro_modulo_u_otra_accion_no_habilita(
        self, db_session, usuario_local, rol_con_permisos
    ):
        rol = rol_con_permisos("docente de prueba", [(MODULO_ACADEMICO, ACCION_LEER)])
        db_session.add(UsuarioRol(usuario_id=usuario_local.id, rol_id=rol.id))
        db_session.commit()

        assert not service.tiene_permiso(
            db_session, usuario_local.id, MODULO_ACADEMICO, ACCION_ACTUALIZAR
        )
        assert not service.tiene_permiso(
            db_session, usuario_local.id, MODULO_AUTENTICACION, ACCION_LEER
        )

    def test_dos_roles_donde_solo_uno_habilita_gana_el_mas_permisivo(
        self, db_session, usuario_local, rol_con_permisos
    ):
        rol_sin_permiso = rol_con_permisos(
            "sin acceso académico", [(MODULO_AUTENTICACION, ACCION_LEER)]
        )
        rol_con_permiso = rol_con_permisos(
            "con acceso académico", [(MODULO_ACADEMICO, ACCION_LEER)]
        )
        db_session.add(UsuarioRol(usuario_id=usuario_local.id, rol_id=rol_sin_permiso.id))
        db_session.add(UsuarioRol(usuario_id=usuario_local.id, rol_id=rol_con_permiso.id))
        db_session.commit()

        assert service.tiene_permiso(db_session, usuario_local.id, MODULO_ACADEMICO, ACCION_LEER)

    def test_tipo_informacion_none_pedido_lo_satisface_cualquier_permiso_del_modulo(
        self, db_session, usuario_local, rol_con_permisos
    ):
        rol = rol_con_permisos(
            "bienestar de prueba", [(MODULO_ACADEMICO, ACCION_LEER, "datos_medicos")]
        )
        db_session.add(UsuarioRol(usuario_id=usuario_local.id, rol_id=rol.id))
        db_session.commit()

        assert service.tiene_permiso(db_session, usuario_local.id, MODULO_ACADEMICO, ACCION_LEER)

    def test_permiso_amplio_null_satisface_un_pedido_con_tipo_informacion(
        self, db_session, usuario_local, rol_con_permisos
    ):
        rol = rol_con_permisos("coordinación de prueba", [(MODULO_ACADEMICO, ACCION_LEER)])
        db_session.add(UsuarioRol(usuario_id=usuario_local.id, rol_id=rol.id))
        db_session.commit()

        assert service.tiene_permiso(
            db_session, usuario_local.id, MODULO_ACADEMICO, ACCION_LEER, "datos_medicos"
        )

    def test_permiso_de_un_tipo_no_satisface_pedido_de_otro_tipo(
        self, db_session, usuario_local, rol_con_permisos
    ):
        rol = rol_con_permisos(
            "bienestar de prueba", [(MODULO_ACADEMICO, ACCION_LEER, "datos_medicos")]
        )
        db_session.add(UsuarioRol(usuario_id=usuario_local.id, rol_id=rol.id))
        db_session.commit()

        assert not service.tiene_permiso(
            db_session, usuario_local.id, MODULO_ACADEMICO, ACCION_LEER, "datos_disciplinarios"
        )


class TestRequierePermisoHTTP:
    """GET /auth/roles como endpoint de referencia: exige (Autenticación, leer)."""

    def test_sin_cookie_devuelve_401(self, client):
        assert client.get("/auth/roles").status_code == 401

    def test_con_sesion_pero_sin_permiso_devuelve_403(self, client, usuario_local):
        login(client, usuario_local)
        assert client.get("/auth/roles").status_code == 403

    def test_con_el_permiso_devuelve_200(self, client_admin):
        assert client_admin.get("/auth/roles").status_code == 200

    def test_usuario_inactivo_devuelve_403_de_cuenta_no_de_permiso(
        self, client, db_session, usuario_local, rol_con_permisos
    ):
        rol = rol_con_permisos("admin de prueba", [(MODULO_AUTENTICACION, ACCION_LEER)])
        db_session.add(UsuarioRol(usuario_id=usuario_local.id, rol_id=rol.id))
        db_session.commit()
        login(client, usuario_local)

        usuario_local.estado = "inactivo"
        db_session.commit()

        assert client.get("/auth/roles").status_code == 403
