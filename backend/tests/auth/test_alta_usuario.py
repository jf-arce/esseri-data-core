"""POST /auth/usuarios: alta de cuentas de personal (no familia, no docente)."""

from src.auth.models import Rol


def _payload(
    rol_ids, metodo="local", password="una-contrasenia-larga", email="nueva@esseri.edu.ar"
):
    acceso = {"email": email, "metodo": metodo}
    if metodo == "local":
        acceso["password"] = password
    return {
        "persona": {"nombre": "Ana", "apellido": "Pérez", "dni": "30111222"},
        "acceso": acceso,
        "rol_ids": rol_ids,
    }


class TestCrearUsuario:
    def test_sin_cookie_devuelve_401(self, client):
        assert client.post("/auth/usuarios", json=_payload([])).status_code == 401

    def test_sin_permiso_devuelve_403(self, client, usuario_local):
        client.post(
            "/auth/login", json={"email": usuario_local.email, "password": "una-contrasenia-larga"}
        )
        assert client.post("/auth/usuarios", json=_payload([])).status_code == 403

    def test_alta_local_crea_cuenta_habilitada_para_login(self, client_admin, db_session):
        rol = Rol(nombre="secretaría")
        db_session.add(rol)
        db_session.commit()

        respuesta = client_admin.post(
            "/auth/usuarios", json=_payload([str(rol.id)], metodo="local")
        )

        assert respuesta.status_code == 201
        cuerpo = respuesta.json()
        assert cuerpo["email"] == "nueva@esseri.edu.ar"
        assert cuerpo["auth_provider"] == "local"
        assert cuerpo["persona_id"] is not None
        assert [r["codigo"] for r in cuerpo["roles"]] == [rol.codigo]

        # la cuenta recién creada puede loguearse
        login = client_admin.post(
            "/auth/login",
            json={"email": "nueva@esseri.edu.ar", "password": "una-contrasenia-larga"},
        )
        assert login.status_code == 200

    def test_alta_google_no_guarda_password(self, client_admin, db_session):
        rol = Rol(nombre="compras")
        db_session.add(rol)
        db_session.commit()

        respuesta = client_admin.post(
            "/auth/usuarios",
            json=_payload([str(rol.id)], metodo="google", email="docente-google@esseri.edu.ar"),
        )

        assert respuesta.status_code == 201
        assert respuesta.json()["auth_provider"] == "google"

    def test_email_duplicado_devuelve_409(self, client_admin, db_session, usuario_local):
        rol = Rol(nombre="compras")
        db_session.add(rol)
        db_session.commit()

        respuesta = client_admin.post(
            "/auth/usuarios", json=_payload([str(rol.id)], email=usuario_local.email)
        )
        assert respuesta.status_code == 409

    def test_rol_familia_es_rechazado(self, client_admin, db_session):
        rol = Rol(nombre="familia")
        db_session.add(rol)
        db_session.commit()

        respuesta = client_admin.post("/auth/usuarios", json=_payload([str(rol.id)]))
        assert respuesta.status_code == 422

    def test_rol_docente_es_rechazado(self, client_admin, db_session):
        rol = Rol(nombre="docente")
        db_session.add(rol)
        db_session.commit()

        respuesta = client_admin.post("/auth/usuarios", json=_payload([str(rol.id)]))
        assert respuesta.status_code == 422

    def test_local_sin_password_es_422(self, client_admin, db_session):
        rol = Rol(nombre="compras")
        db_session.add(rol)
        db_session.commit()
        payload = _payload([str(rol.id)])
        del payload["acceso"]["password"]

        assert client_admin.post("/auth/usuarios", json=payload).status_code == 422

    def test_google_con_password_es_422(self, client_admin, db_session):
        rol = Rol(nombre="compras")
        db_session.add(rol)
        db_session.commit()
        payload = _payload([str(rol.id)], metodo="google")
        payload["acceso"]["password"] = "esto-no-deberia-ir"

        assert client_admin.post("/auth/usuarios", json=payload).status_code == 422

    def test_rol_inexistente_devuelve_409(self, client_admin):
        respuesta = client_admin.post(
            "/auth/usuarios", json=_payload(["00000000-0000-0000-0000-000000000000"])
        )
        assert respuesta.status_code == 409
