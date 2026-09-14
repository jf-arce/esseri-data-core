"""PATCH /auth/usuarios/{id} y PUT /auth/usuarios/{id}/acceso: edición de una cuenta existente."""

import uuid

from src.models import Persona
from tests.auth.conftest import PASSWORD_VALIDA


class TestObtenerUsuario:
    def test_sin_cookie_devuelve_401(self, client, usuario_local):
        assert client.get(f"/auth/usuarios/{usuario_local.id}").status_code == 401

    def test_sin_permiso_devuelve_403(self, client, usuario_local):
        client.post("/auth/login", json={"email": usuario_local.email, "password": PASSWORD_VALIDA})
        assert client.get(f"/auth/usuarios/{usuario_local.id}").status_code == 403

    def test_incluye_dni_y_telefono(self, client_admin, db_session, usuario_local):
        persona = Persona(nombre="Ana", apellido="Pérez", dni="30111222", telefono="1155554444")
        db_session.add(persona)
        db_session.commit()
        usuario_local.persona_id = persona.id
        db_session.commit()

        respuesta = client_admin.get(f"/auth/usuarios/{usuario_local.id}")

        assert respuesta.status_code == 200
        cuerpo = respuesta.json()
        assert cuerpo["persona_dni"] == "30111222"
        assert cuerpo["persona_telefono"] == "1155554444"

    def test_usuario_inexistente_devuelve_404(self, client_admin):
        assert client_admin.get(f"/auth/usuarios/{uuid.uuid4()}").status_code == 404


class TestActualizarUsuario:
    def test_edita_los_datos_de_la_persona(self, client_admin, db_session, usuario_local):
        persona = Persona(nombre="Ana", apellido="Pérez", dni="30111222")
        db_session.add(persona)
        db_session.commit()
        usuario_local.persona_id = persona.id
        db_session.commit()

        respuesta = client_admin.patch(
            f"/auth/usuarios/{usuario_local.id}",
            json={"persona": {"nombre": "Anita", "telefono": "1122334455"}},
        )

        assert respuesta.status_code == 200
        cuerpo = respuesta.json()
        assert cuerpo["persona_nombre"] == "Anita"
        assert cuerpo["persona_telefono"] == "1122334455"
        # No se manda apellido ni dni: quedan igual.
        assert cuerpo["persona_apellido"] == "Pérez"
        assert cuerpo["persona_dni"] == "30111222"

    def test_crea_la_persona_si_la_cuenta_no_tenia(self, client_admin, usuario_google):
        respuesta = client_admin.patch(
            f"/auth/usuarios/{usuario_google.id}",
            json={"persona": {"nombre": "Marta", "apellido": "Gómez", "dni": "27888999"}},
        )

        assert respuesta.status_code == 200
        cuerpo = respuesta.json()
        assert cuerpo["persona_id"] is not None
        assert cuerpo["persona_nombre"] == "Marta"

    def test_crear_persona_sin_dni_devuelve_422(self, client_admin, usuario_google):
        respuesta = client_admin.patch(
            f"/auth/usuarios/{usuario_google.id}",
            json={"persona": {"nombre": "Marta", "apellido": "Gómez"}},
        )

        assert respuesta.status_code == 422

    def test_cambiar_el_email(self, client_admin, usuario_local):
        respuesta = client_admin.patch(
            f"/auth/usuarios/{usuario_local.id}", json={"email": "nuevo@esseri.edu.ar"}
        )

        assert respuesta.status_code == 200
        assert respuesta.json()["email"] == "nuevo@esseri.edu.ar"

    def test_email_duplicado_devuelve_409(self, client_admin, usuario_local, usuario_google):
        respuesta = client_admin.patch(
            f"/auth/usuarios/{usuario_local.id}", json={"email": usuario_google.email}
        )

        assert respuesta.status_code == 409

    def test_cambiar_el_email_desvincula_provider_subject(
        self, client_admin, db_session, usuario_google
    ):
        assert usuario_google.provider_subject is not None

        respuesta = client_admin.patch(
            f"/auth/usuarios/{usuario_google.id}", json={"email": "otro@esseri.edu.ar"}
        )

        assert respuesta.status_code == 200
        db_session.refresh(usuario_google)
        assert usuario_google.provider_subject is None


class TestActualizarAcceso:
    def test_resetea_la_contrasenia_y_permite_loguearse(self, client_admin, usuario_local):
        respuesta = client_admin.put(
            f"/auth/usuarios/{usuario_local.id}/acceso",
            json={"metodo": "local", "password": "una-contrasenia-nueva-larga"},
        )
        assert respuesta.status_code == 204

        login = client_admin.post(
            "/auth/login",
            json={"email": usuario_local.email, "password": "una-contrasenia-nueva-larga"},
        )
        assert login.status_code == 200

    def test_pasar_a_google_deja_la_cuenta_sin_contrasenia(
        self, client_admin, db_session, usuario_local
    ):
        respuesta = client_admin.put(
            f"/auth/usuarios/{usuario_local.id}/acceso", json={"metodo": "google"}
        )

        assert respuesta.status_code == 204
        db_session.refresh(usuario_local)
        assert usuario_local.password_hash is None
        assert usuario_local.auth_provider == "google"

    def test_local_sin_password_devuelve_422(self, client_admin, usuario_local):
        respuesta = client_admin.put(
            f"/auth/usuarios/{usuario_local.id}/acceso", json={"metodo": "local"}
        )
        assert respuesta.status_code == 422

    def test_password_corta_devuelve_422(self, client_admin, usuario_local):
        respuesta = client_admin.put(
            f"/auth/usuarios/{usuario_local.id}/acceso",
            json={"metodo": "local", "password": "corta"},
        )
        assert respuesta.status_code == 422
