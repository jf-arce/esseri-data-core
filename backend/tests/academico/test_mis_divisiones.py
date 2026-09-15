"""GET /academico/docentes/me/divisiones: dato propio del usuario autenticado, sin depender
de `academico.leer` — un docente no tiene ese permiso (grupo-b.yaml) pero sí necesita ver sus
propias divisiones para la pantalla "¿Cómo querés entrar?" del frontend."""

import uuid

from src.academico.models import Anio, AsignacionDocente, Division, Docente, Materia, NivelEducativo
from src.auth import sesion_service
from src.auth.models import Usuario
from src.models import Persona

PASSWORD_VALIDA = "una-contrasenia-larga"


def _crear_docente_con_division(db_session, *, con_usuario=True):
    persona_id = uuid.uuid4()
    nivel_id = uuid.uuid4()
    anio_id = uuid.uuid4()
    division_id = uuid.uuid4()
    materia_id = uuid.uuid4()
    docente_id = uuid.uuid4()

    persona = Persona(id=persona_id, nombre="Julieta", apellido="Amaya", dni="40222333")
    usuario = Usuario(
        email="julieta.amaya@esseri.edu.ar",
        password_hash=sesion_service.hashear_password(PASSWORD_VALIDA),
        auth_provider="local",
        estado="activo",
        persona_id=persona_id if con_usuario else None,
    )
    db_session.add_all(
        [
            persona,
            usuario,
            NivelEducativo(id=nivel_id, nombre="Primario"),
            Anio(id=anio_id, numero=4, nivel_educativo_id=nivel_id),
            Division(id=division_id, nombre="4°B", anio_id=anio_id),
            Materia(id=materia_id, nombre="Matemática", tipo="materia", anio_id=anio_id),
            Docente(id=docente_id, legajo="D-001", persona_id=persona_id),
            AsignacionDocente(
                ciclo_lectivo="2027",
                docente_id=docente_id,
                materia_id=materia_id,
                division_id=division_id,
            ),
        ]
    )
    db_session.commit()
    return usuario


def login(client, usuario):
    return client.post("/auth/login", json={"email": usuario.email, "password": PASSWORD_VALIDA})


def test_sin_sesion_rechaza(client):
    assert client.get("/academico/docentes/me/divisiones").status_code == 401


def test_docente_ve_sus_propias_divisiones(client, db_session):
    usuario = _crear_docente_con_division(db_session)
    login(client, usuario)

    respuesta = client.get("/academico/docentes/me/divisiones")

    assert respuesta.status_code == 200
    assert respuesta.json() == [
        {"division_id": str(_division_id_de(db_session)), "etiqueta": "4°B"}
    ]


def test_usuario_sin_persona_vinculada_devuelve_lista_vacia(client, db_session):
    usuario = _crear_docente_con_division(db_session, con_usuario=False)
    login(client, usuario)

    assert client.get("/academico/docentes/me/divisiones").json() == []


def test_etiqueta_no_duplica_el_anio_cuando_ya_esta_en_el_nombre(client, db_session):
    """Reproduce el bug real (dato de un ambiente de prueba, no un caso inventado):
    `Division.nombre` es la etiqueta completa (ver `nivel-seccion.tsx` y sus tests, y los
    datos reales -- "1°A", "3°C"), no un sufijo suelto tipo "B". Anteponerle `Anio.numero`
    duplicaba el año cuando no coincidía con el que ya viene en el nombre: un año 1 con una
    división nombrada "3°C" salía como "1°3°C" en vez de "3°C"."""
    persona_id = uuid.uuid4()
    nivel_id = uuid.uuid4()
    anio_id = uuid.uuid4()
    division_id = uuid.uuid4()
    materia_id = uuid.uuid4()
    docente_id = uuid.uuid4()

    persona = Persona(id=persona_id, nombre="Jorgelina", apellido="Moralejo", dni="40333444")
    usuario = Usuario(
        email="jorgelina.moralejo@esseri.edu.ar",
        password_hash=sesion_service.hashear_password(PASSWORD_VALIDA),
        auth_provider="local",
        estado="activo",
        persona_id=persona_id,
    )
    db_session.add_all(
        [
            persona,
            usuario,
            NivelEducativo(id=nivel_id, nombre="Primario"),
            Anio(id=anio_id, numero=1, nivel_educativo_id=nivel_id),
            Division(id=division_id, nombre="3°C", anio_id=anio_id),
            Materia(id=materia_id, nombre="Matemática", tipo="materia", anio_id=anio_id),
            Docente(id=docente_id, legajo="D-002", persona_id=persona_id),
            AsignacionDocente(
                ciclo_lectivo="2027",
                docente_id=docente_id,
                materia_id=materia_id,
                division_id=division_id,
            ),
        ]
    )
    db_session.commit()
    login(client, usuario)

    respuesta = client.get("/academico/docentes/me/divisiones")

    assert respuesta.json() == [{"division_id": str(division_id), "etiqueta": "3°C"}]


def _division_id_de(db_session):
    return db_session.query(Division.id).scalar()
