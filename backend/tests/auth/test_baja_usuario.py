"""PUT /auth/usuarios/{id}/estado (baja lógica / reactivación) y DELETE (borrado físico)."""

from src.academico.models import Docente
from src.auth.constants import (
    ACCION_ACTUALIZAR,
    ACCION_ELIMINAR,
    ACCION_LEER,
    MODULO_AUTENTICACION,
)
from src.auth.models import LogAcceso, Usuario, UsuarioRol
from src.auth.sesion_service import hashear_password
from src.ia_sugerencias.models import IaSugerencia
from src.models import Persona
from tests.auth.conftest import PASSWORD_VALIDA


class TestCambiarEstado:
    def test_dar_de_baja_corta_el_login(self, client_admin, usuario_google):
        respuesta = client_admin.put(
            f"/auth/usuarios/{usuario_google.id}/estado", json={"estado": "inactivo"}
        )
        assert respuesta.status_code == 204

        # Google respondería "identidad válida" igual; lo que corta el acceso es el estado.
        assert client_admin.get(f"/auth/usuarios/{usuario_google.id}").json()["estado"] == (
            "inactivo"
        )

    def test_dar_de_baja_corta_la_sesion_activa(self, client, db_session, usuario_local):
        login = client.post(
            "/auth/login", json={"email": usuario_local.email, "password": PASSWORD_VALIDA}
        )
        assert login.status_code == 200

        usuario_local.estado = "inactivo"
        db_session.add(usuario_local)
        db_session.commit()

        assert client.get("/auth/me").status_code == 403

    def test_reactivar_permite_loguearse_de_nuevo(self, client_admin, db_session, usuario_google):
        usuario_google.estado = "inactivo"
        db_session.commit()

        respuesta = client_admin.put(
            f"/auth/usuarios/{usuario_google.id}/estado", json={"estado": "activo"}
        )

        assert respuesta.status_code == 204
        db_session.refresh(usuario_google)
        assert usuario_google.estado == "activo"

    def test_no_se_puede_dar_de_baja_la_propia_cuenta(self, client_admin, usuario_local):
        respuesta = client_admin.put(
            f"/auth/usuarios/{usuario_local.id}/estado", json={"estado": "inactivo"}
        )
        assert respuesta.status_code == 409

    def test_anti_lockout_al_dar_de_baja_al_unico_administrador(
        self, client, db_session, usuario_local, rol_con_permisos
    ):
        """El actor tiene permiso de ELIMINAR pero no de ACTUALIZAR: no cuenta como
        administrador, así que dar de baja al único que sí lo es dejaría el sistema sin
        nadie que administre roles y permisos."""
        rol_actor = rol_con_permisos(
            "moderador de prueba",
            [(MODULO_AUTENTICACION, ACCION_LEER), (MODULO_AUTENTICACION, ACCION_ELIMINAR)],
        )
        actor = _crear_usuario_local(db_session, "moderador@esseri.edu.ar")
        db_session.add(UsuarioRol(usuario_id=actor.id, rol_id=rol_actor.id))
        db_session.commit()
        client.post("/auth/login", json={"email": actor.email, "password": PASSWORD_VALIDA})

        respuesta = client.put(
            f"/auth/usuarios/{usuario_local.id}/estado", json={"estado": "inactivo"}
        )

        assert respuesta.status_code == 409

    def test_no_dispara_el_guard_si_hay_otro_administrador_activo(
        self, client_admin, db_session, usuario_local, usuario_google, rol_con_permisos
    ):
        otro_rol_admin = rol_con_permisos("otro admin", [(MODULO_AUTENTICACION, ACCION_ACTUALIZAR)])
        db_session.add(UsuarioRol(usuario_id=usuario_google.id, rol_id=otro_rol_admin.id))
        db_session.commit()

        respuesta = client_admin.put(
            f"/auth/usuarios/{usuario_google.id}/estado", json={"estado": "inactivo"}
        )

        assert respuesta.status_code == 204


class TestEliminarUsuario:
    def test_no_se_puede_eliminar_la_propia_cuenta(self, client_admin, usuario_local):
        assert client_admin.delete(f"/auth/usuarios/{usuario_local.id}").status_code == 409

    def test_borra_usuario_roles_y_persona(self, client_admin, db_session, usuario_google):
        persona = Persona(nombre="Marta", apellido="Gómez", dni="27888999")
        db_session.add(persona)
        db_session.commit()
        usuario_google.persona_id = persona.id
        db_session.commit()
        persona_id = persona.id

        respuesta = client_admin.delete(f"/auth/usuarios/{usuario_google.id}")

        assert respuesta.status_code == 204
        assert client_admin.get(f"/auth/usuarios/{usuario_google.id}").status_code == 404
        assert db_session.get(Persona, persona_id) is None

    def test_conserva_log_acceso_con_usuario_id_null(self, client, client_admin, db_session):
        objetivo = _crear_usuario_local(db_session, "conlog@esseri.edu.ar")
        # Un intento fallido (contraseña incorrecta) deja una fila de LOG_ACCESO apuntando a él.
        client.post("/auth/login", json={"email": objetivo.email, "password": "incorrecta"})

        assert db_session.query(LogAcceso).filter_by(usuario_id=objetivo.id).count() == 1

        respuesta = client_admin.delete(f"/auth/usuarios/{objetivo.id}")
        assert respuesta.status_code == 204

        assert db_session.query(LogAcceso).filter_by(usuario_id=objetivo.id).count() == 0
        assert db_session.query(LogAcceso).filter_by(usuario_id=None).count() == 1

    def test_no_se_puede_eliminar_con_historial(self, client_admin, db_session, usuario_google):
        db_session.add(
            IaSugerencia(
                tipo="comunicacion", contenido_generado="hola", usuario_id=usuario_google.id
            )
        )
        db_session.commit()

        respuesta = client_admin.delete(f"/auth/usuarios/{usuario_google.id}")

        assert respuesta.status_code == 409

    def test_eliminar_conserva_la_persona_si_la_referencia_un_docente(
        self, client_admin, db_session, usuario_google
    ):
        persona = Persona(nombre="Marta", apellido="Gómez", dni="27888999")
        db_session.add(persona)
        db_session.commit()
        usuario_google.persona_id = persona.id
        db_session.add(Docente(persona_id=persona.id, legajo="DOC-000123"))
        db_session.commit()
        persona_id = persona.id

        respuesta = client_admin.delete(f"/auth/usuarios/{usuario_google.id}")

        assert respuesta.status_code == 204
        assert db_session.get(Persona, persona_id) is not None

    def test_anti_lockout_al_eliminar_al_unico_administrador(
        self, client, db_session, usuario_local, rol_con_permisos
    ):
        rol_actor = rol_con_permisos(
            "moderador de prueba 2",
            [(MODULO_AUTENTICACION, ACCION_LEER), (MODULO_AUTENTICACION, ACCION_ELIMINAR)],
        )
        actor = _crear_usuario_local(db_session, "moderador2@esseri.edu.ar")
        db_session.add(UsuarioRol(usuario_id=actor.id, rol_id=rol_actor.id))
        db_session.commit()
        client.post("/auth/login", json={"email": actor.email, "password": PASSWORD_VALIDA})

        respuesta = client.delete(f"/auth/usuarios/{usuario_local.id}")

        assert respuesta.status_code == 409


def _crear_usuario_local(db_session, email):
    usuario = Usuario(
        email=email,
        password_hash=hashear_password(PASSWORD_VALIDA),
        auth_provider="local",
        estado="activo",
    )
    db_session.add(usuario)
    db_session.commit()
    return usuario
