"""GET /auth/usuarios: el listado que faltaba para el selector de rol(es) por usuario (RF-29)."""

from src.auth.models import Usuario
from src.models import Persona
from tests.auth.conftest import PASSWORD_VALIDA


def login(client, usuario):
    return client.post("/auth/login", json={"email": usuario.email, "password": PASSWORD_VALIDA})


class TestListarUsuarios:
    def test_sin_cookie_devuelve_401(self, client):
        assert client.get("/auth/usuarios").status_code == 401

    def test_con_sesion_pero_sin_permiso_devuelve_403(self, client, usuario_local):
        login(client, usuario_local)
        assert client.get("/auth/usuarios").status_code == 403

    def test_devuelve_todos_los_usuarios_con_sus_roles(
        self, client_admin, usuario_local, usuario_google
    ):
        respuesta = client_admin.get("/auth/usuarios")

        assert respuesta.status_code == 200
        cuerpo = respuesta.json()
        emails = {u["email"] for u in cuerpo}
        assert {usuario_local.email, usuario_google.email} <= emails

        admin = next(u for u in cuerpo if u["email"] == usuario_local.email)
        assert admin["estado"] == "activo"
        assert admin["auth_provider"] == "local"
        assert [r["nombre"] for r in admin["roles"]] == ["admin de prueba"]

        sin_rol = next(u for u in cuerpo if u["email"] == usuario_google.email)
        assert sin_rol["roles"] == []

    def test_incluye_nombre_y_apellido_de_la_persona(self, client_admin, db_session):
        """El nombre visible en la UI tiene que ser el de la persona, no uno inventado a partir
        del email — el listado tiene que traer esos datos para que el frontend no tenga que
        adivinarlo."""
        persona = Persona(nombre="Julieta", apellido="Amaya", dni="40222333")
        db_session.add(persona)
        db_session.flush()
        usuario = Usuario(
            email="julieta@esseri.edu.ar",
            auth_provider="google",
            estado="activo",
            persona_id=persona.id,
        )
        db_session.add(usuario)
        db_session.commit()

        cuerpo = client_admin.get("/auth/usuarios").json()
        fila = next(u for u in cuerpo if u["email"] == usuario.email)
        assert fila["persona_nombre"] == "Julieta"
        assert fila["persona_apellido"] == "Amaya"

    def test_persona_nombre_es_null_sin_persona_asociada(self, client_admin, usuario_google):
        cuerpo = client_admin.get("/auth/usuarios").json()
        fila = next(u for u in cuerpo if u["email"] == usuario_google.email)
        assert fila["persona_nombre"] is None
        assert fila["persona_apellido"] is None

    def test_orden_alfabetico_por_email(self, client_admin, usuario_local, usuario_google):
        emails = [u["email"] for u in client_admin.get("/auth/usuarios").json()]
        assert emails == sorted(emails)
