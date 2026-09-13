"""POST /academico/docentes/alta-completa y /desde-usuario: alta de cuentas docente."""

import pytest

from src.academico.models import Docente
from src.auth import service
from src.auth.models import Rol, Usuario, UsuarioRol
from src.models import Persona


@pytest.fixture()
def usuario_docente(db_session):
    """Una cuenta ya existente con persona propia, sin rol docente ni ficha Docente todavía —
    el caso que resuelve `POST /academico/docentes/desde-usuario` (ej. una familia que además
    da clases)."""
    persona = Persona(nombre="Carla", apellido="Núñez", dni="38444555")
    db_session.add(persona)
    db_session.flush()
    usuario = Usuario(
        email="cuenta-existente@esseri.edu.ar",
        password_hash=service.hashear_password("una-contrasenia-larga"),
        auth_provider="local",
        estado="activo",
        persona_id=persona.id,
    )
    db_session.add(usuario)
    db_session.commit()
    return usuario


def _payload_alta(legajo="DOC-001", email="nuevo-docente@esseri.edu.ar"):
    return {
        "persona": {"nombre": "Marta", "apellido": "Ríos", "dni": "35111222"},
        "acceso": {"email": email, "metodo": "local", "password": "una-contrasenia-larga"},
        "legajo": legajo,
    }


class TestAltaDocente:
    def test_sin_permiso_devuelve_403(self, client_docente):
        assert (
            client_docente.post(
                "/academico/docentes/alta-completa", json=_payload_alta()
            ).status_code
            == 403
        )

    def test_crea_persona_usuario_rol_y_docente(self, client_secretaria, db_session):
        rol_docente = Rol(nombre="docente")
        db_session.add(rol_docente)
        db_session.commit()

        respuesta = client_secretaria.post(
            "/academico/docentes/alta-completa", json=_payload_alta()
        )

        assert respuesta.status_code == 201
        cuerpo = respuesta.json()
        assert cuerpo["legajo"] == "DOC-001"

        usuario = db_session.query(Usuario).filter_by(email="nuevo-docente@esseri.edu.ar").first()
        assert usuario is not None
        assert usuario.persona_id is not None
        vinculo = (
            db_session.query(UsuarioRol)
            .filter_by(usuario_id=usuario.id, rol_id=rol_docente.id)
            .first()
        )
        assert vinculo is not None

    def test_legajo_duplicado_devuelve_409_sin_dejar_huerfanos(self, client_secretaria, db_session):
        rol_docente = Rol(nombre="docente")
        db_session.add(rol_docente)
        db_session.commit()

        persona = Persona(nombre="X", apellido="Y", dni="1")
        db_session.add(persona)
        db_session.flush()
        db_session.add(Docente(legajo="DOC-DUP", persona_id=persona.id))
        db_session.commit()

        respuesta = client_secretaria.post(
            "/academico/docentes/alta-completa",
            json=_payload_alta(legajo="DOC-DUP", email="otro@esseri.edu.ar"),
        )

        assert respuesta.status_code == 409
        assert db_session.query(Usuario).filter_by(email="otro@esseri.edu.ar").first() is None

    def test_email_duplicado_devuelve_409(self, client_secretaria, db_session, usuario_docente):
        rol_docente = Rol(nombre="docente")
        db_session.add(rol_docente)
        db_session.commit()

        respuesta = client_secretaria.post(
            "/academico/docentes/alta-completa",
            json=_payload_alta(email=usuario_docente.email),
        )
        assert respuesta.status_code == 409


class TestDocenteDesdeUsuario:
    def test_crea_ficha_y_asigna_rol_a_cuenta_existente(
        self, client_secretaria, db_session, usuario_docente
    ):
        rol_docente = Rol(nombre="docente")
        db_session.add(rol_docente)
        db_session.commit()

        respuesta = client_secretaria.post(
            "/academico/docentes/desde-usuario",
            json={"usuario_id": str(usuario_docente.id), "legajo": "DOC-777"},
        )

        assert respuesta.status_code == 201
        assert respuesta.json()["legajo"] == "DOC-777"

        vinculo = (
            db_session.query(UsuarioRol)
            .filter_by(usuario_id=usuario_docente.id, rol_id=rol_docente.id)
            .first()
        )
        assert vinculo is not None

    def test_idempotente_si_la_cuenta_ya_tenia_el_rol(
        self, client_secretaria, db_session, usuario_docente
    ):
        rol_docente = Rol(nombre="docente")
        db_session.add(rol_docente)
        db_session.flush()
        db_session.add(UsuarioRol(usuario_id=usuario_docente.id, rol_id=rol_docente.id))
        db_session.commit()

        respuesta = client_secretaria.post(
            "/academico/docentes/desde-usuario",
            json={"usuario_id": str(usuario_docente.id), "legajo": "DOC-888"},
        )
        assert respuesta.status_code == 201

    def test_cuenta_sin_persona_devuelve_409(self, client_secretaria, db_session):
        rol_docente = Rol(nombre="docente")
        usuario_sin_persona = Usuario(
            email="sin-persona@esseri.edu.ar",
            auth_provider="google",
            estado="activo",
        )
        db_session.add_all([rol_docente, usuario_sin_persona])
        db_session.commit()

        respuesta = client_secretaria.post(
            "/academico/docentes/desde-usuario",
            json={"usuario_id": str(usuario_sin_persona.id), "legajo": "DOC-999"},
        )
        assert respuesta.status_code == 409
