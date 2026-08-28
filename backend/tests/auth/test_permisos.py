"""Autorización por permisos (RF-30): el núcleo es `service.tiene_permiso`."""

from src.auth import service
from src.auth.constants import (
    MODULO_ACADEMICO,
    MODULO_AUTENTICACION,
    PERMISO_AUTENTICACION_LEER,
    codigo_de,
)
from src.auth.models import UsuarioRol
from tests.auth.conftest import PASSWORD_VALIDA

ACADEMICO_LEER = codigo_de(MODULO_ACADEMICO, "leer")
ACADEMICO_ACTUALIZAR = codigo_de(MODULO_ACADEMICO, "actualizar")
ACADEMICO_LEER_DATOS_MEDICOS = codigo_de(MODULO_ACADEMICO, "leer", "datos_medicos")
ACADEMICO_LEER_DATOS_DISCIPLINARIOS = codigo_de(MODULO_ACADEMICO, "leer", "datos_disciplinarios")


def login(client, usuario):
    return client.post("/auth/login", json={"email": usuario.email, "password": PASSWORD_VALIDA})


class TestTienePermiso:
    def test_usuario_sin_roles_no_tiene_ningun_permiso(self, db_session, usuario_local):
        assert not service.tiene_permiso(db_session, usuario_local.id, ACADEMICO_LEER)

    def test_permiso_exacto_habilita(self, db_session, usuario_local, rol_con_permisos):
        rol = rol_con_permisos("docente de prueba", [(MODULO_ACADEMICO, "leer")])
        db_session.add(UsuarioRol(usuario_id=usuario_local.id, rol_id=rol.id))
        db_session.commit()

        assert service.tiene_permiso(db_session, usuario_local.id, ACADEMICO_LEER)

    def test_otro_modulo_u_otra_accion_no_habilita(
        self, db_session, usuario_local, rol_con_permisos
    ):
        rol = rol_con_permisos("docente de prueba", [(MODULO_ACADEMICO, "leer")])
        db_session.add(UsuarioRol(usuario_id=usuario_local.id, rol_id=rol.id))
        db_session.commit()

        assert not service.tiene_permiso(db_session, usuario_local.id, ACADEMICO_ACTUALIZAR)
        assert not service.tiene_permiso(db_session, usuario_local.id, PERMISO_AUTENTICACION_LEER)

    def test_dos_roles_donde_solo_uno_habilita_gana_el_mas_permisivo(
        self, db_session, usuario_local, rol_con_permisos
    ):
        rol_sin_permiso = rol_con_permisos("sin acceso académico", [(MODULO_AUTENTICACION, "leer")])
        rol_con_permiso = rol_con_permisos("con acceso académico", [(MODULO_ACADEMICO, "leer")])
        db_session.add(UsuarioRol(usuario_id=usuario_local.id, rol_id=rol_sin_permiso.id))
        db_session.add(UsuarioRol(usuario_id=usuario_local.id, rol_id=rol_con_permiso.id))
        db_session.commit()

        assert service.tiene_permiso(db_session, usuario_local.id, ACADEMICO_LEER)

    def test_tipo_informacion_none_pedido_lo_satisface_cualquier_permiso_del_modulo(
        self, db_session, usuario_local, rol_con_permisos
    ):
        rol = rol_con_permisos("bienestar de prueba", [(MODULO_ACADEMICO, "leer", "datos_medicos")])
        db_session.add(UsuarioRol(usuario_id=usuario_local.id, rol_id=rol.id))
        db_session.commit()

        assert service.tiene_permiso(db_session, usuario_local.id, ACADEMICO_LEER)

    def test_permiso_amplio_null_satisface_un_pedido_con_tipo_informacion(
        self, db_session, usuario_local, rol_con_permisos
    ):
        rol = rol_con_permisos("coordinación de prueba", [(MODULO_ACADEMICO, "leer")])
        db_session.add(UsuarioRol(usuario_id=usuario_local.id, rol_id=rol.id))
        db_session.commit()

        assert service.tiene_permiso(db_session, usuario_local.id, ACADEMICO_LEER_DATOS_MEDICOS)

    def test_permiso_de_un_tipo_no_satisface_pedido_de_otro_tipo(
        self, db_session, usuario_local, rol_con_permisos
    ):
        rol = rol_con_permisos("bienestar de prueba", [(MODULO_ACADEMICO, "leer", "datos_medicos")])
        db_session.add(UsuarioRol(usuario_id=usuario_local.id, rol_id=rol.id))
        db_session.commit()

        assert not service.tiene_permiso(
            db_session, usuario_local.id, ACADEMICO_LEER_DATOS_DISCIPLINARIOS
        )


class TestCodigoDePermiso:
    """`codigo_de` es la clave estable de autorización: ver docstring en `constants.py`."""

    def test_codigo_sin_tipo_informacion(self):
        assert codigo_de(MODULO_ACADEMICO, "leer") == "academico.leer"

    def test_codigo_con_tipo_informacion(self):
        codigo = codigo_de(MODULO_ACADEMICO, "leer", "datos_medicos")
        assert codigo == "academico.leer:datos_medicos"

    def test_codigo_es_ascii_para_modulos_con_acentos_y_barras(self):
        assert codigo_de(MODULO_AUTENTICACION, "leer") == "autenticacion.leer"
        assert codigo_de("IA/Sugerencias", "leer") == "ia_sugerencias.leer"

    def test_codigo_es_el_mismo_para_nfc_y_nfd_del_mismo_modulo(self):
        """El bug que motivó `codigo`: "Autenticación" en NFC vs NFD son bytes distintos, y
        compararlos como string (el viejo `Permiso.modulo == modulo`) los trataba como
        permisos diferentes sin ningún error visible — denegaba en silencio."""
        import unicodedata

        nfc = MODULO_AUTENTICACION
        nfd = unicodedata.normalize("NFD", nfc)
        assert nfc != nfd  # confirma que son bytes distintos, si no el test no prueba nada
        assert codigo_de(nfc, "leer") == codigo_de(nfd, "leer")


class TestRequierePermisoHTTP:
    """GET /auth/roles como endpoint de referencia: exige autenticacion.leer."""

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
        rol = rol_con_permisos("admin de prueba", [(MODULO_AUTENTICACION, "leer")])
        db_session.add(UsuarioRol(usuario_id=usuario_local.id, rol_id=rol.id))
        db_session.commit()
        login(client, usuario_local)

        usuario_local.estado = "inactivo"
        db_session.commit()

        assert client.get("/auth/roles").status_code == 403
