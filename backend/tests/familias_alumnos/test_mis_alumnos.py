"""GET /familias-alumnos/familias/me/alumnos: dato propio del usuario autenticado, sin
depender de `familias_alumnos.leer` — el rol familia lo tiene (grupo-b.yaml), pero acotado a
lo propio, así que esta ruta no puede depender de ese permiso de módulo."""

import uuid
from datetime import date

from src.academico.models import Anio, Division, NivelEducativo
from src.auth import service
from src.auth.models import Usuario
from src.familias_alumnos.models import Alumno, Familia, FamiliaAlumno
from src.inscripciones.models import Inscripcion
from src.models import Persona

PASSWORD_VALIDA = "una-contrasenia-larga"


def login(client, usuario):
    return client.post("/auth/login", json={"email": usuario.email, "password": PASSWORD_VALIDA})


def _crear_familia_con_alumno(db_session, *, con_usuario=True, con_inscripcion_activa=True):
    persona_familiar_id = uuid.uuid4()
    persona_alumno_id = uuid.uuid4()
    familia_id = uuid.uuid4()
    alumno_id = uuid.uuid4()
    nivel_id = uuid.uuid4()
    anio_id = uuid.uuid4()
    division_id = uuid.uuid4()

    usuario = Usuario(
        email="familia.roldan@esseri.edu.ar",
        password_hash=service.hashear_password(PASSWORD_VALIDA),
        auth_provider="local",
        estado="activo",
        persona_id=persona_familiar_id if con_usuario else None,
    )
    filas = [
        Persona(id=persona_familiar_id, nombre="Susana", apellido="Roldán", dni="30111222"),
        Persona(id=persona_alumno_id, nombre="Martina", apellido="Ibáñez", dni="50111222"),
        usuario,
        Familia(id=familia_id, estado_deuda="al_dia", persona_id=persona_familiar_id),
        Alumno(
            id=alumno_id, numero_legajo="A-2027-010", estado="activo", persona_id=persona_alumno_id
        ),
        FamiliaAlumno(
            parentesco="madre",
            responsable_principal=True,
            recibe_comunicaciones=True,
            familia_id=familia_id,
            alumno_id=alumno_id,
        ),
        NivelEducativo(id=nivel_id, nombre="Primario"),
        Anio(id=anio_id, numero=4, nivel_educativo_id=nivel_id),
        Division(id=division_id, nombre="B", anio_id=anio_id),
    ]
    if con_inscripcion_activa:
        filas.append(
            Inscripcion(
                ciclo_lectivo="2027",
                fecha_inscripcion=date(2026, 8, 27),
                tipo="nueva",
                estado="activa",
                alumno_id=alumno_id,
                division_id=division_id,
            )
        )
    db_session.add_all(filas)
    db_session.commit()
    return usuario, alumno_id


def test_sin_sesion_rechaza(client):
    assert client.get("/familias-alumnos/familias/me/alumnos").status_code == 401


def test_familia_ve_sus_alumnos_con_division_actual(client, db_session):
    usuario, alumno_id = _crear_familia_con_alumno(db_session)
    login(client, usuario)

    respuesta = client.get("/familias-alumnos/familias/me/alumnos")

    assert respuesta.status_code == 200
    assert respuesta.json() == [
        {
            "alumno_id": str(alumno_id),
            "nombre": "Martina",
            "apellido": "Ibáñez",
            "division_etiqueta": "4°B · Primario",
        }
    ]


def test_alumno_sin_inscripcion_activa_devuelve_etiqueta_nula(client, db_session):
    usuario, alumno_id = _crear_familia_con_alumno(db_session, con_inscripcion_activa=False)
    login(client, usuario)

    cuerpo = client.get("/familias-alumnos/familias/me/alumnos").json()

    assert cuerpo[0]["division_etiqueta"] is None


def test_usuario_sin_persona_vinculada_devuelve_lista_vacia(client, db_session):
    usuario, _ = _crear_familia_con_alumno(db_session, con_usuario=False)
    login(client, usuario)

    assert client.get("/familias-alumnos/familias/me/alumnos").json() == []
