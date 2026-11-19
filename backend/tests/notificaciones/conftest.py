"""Escenario de la bandeja interna: familia, alumnos y actores administrativos.

La bandeja no pide un permiso propio: alcanza con el rol Familia vigente y una `Familia`
propia. Los productores académicos se ejercitan con una cuenta administrativa que ya tiene
los permisos del módulo, para no inventar una matriz de permisos paralela.
"""

import uuid
from datetime import UTC, date, datetime

import pytest

from src.academico.models import Anio, Division, MotivoJustificacion, NivelEducativo
from src.auth import sesion_service
from src.auth.constants import (
    ACCION_ACTUALIZAR,
    ACCION_CREAR,
    ACCION_ELIMINAR,
    ACCION_LEER,
    MODULO_ACADEMICO,
)
from src.auth.models import Permiso, Rol, RolPermiso, Usuario, UsuarioRol
from src.familias_alumnos.models import Alumno, Familia, FamiliaAlumno
from src.inscripciones.models import Inscripcion
from src.models import Persona
from src.notificaciones.constants import (
    AMBITO_ACADEMICO,
    DESTINO_ASISTENCIA,
    TIPO_INASISTENCIA_REGISTRADA,
)
from src.notificaciones.models import NotificacionInterna
from tests.academico.conftest import (  # noqa: F401
    tipo_inasistencia_justificada,
    tipo_inasistencia_registrada,
)

PASSWORD_VALIDA = "una-contrasenia-larga"


def _usuario(email: str, persona_id: uuid.UUID | None = None, estado: str = "activo") -> Usuario:
    return Usuario(
        email=email,
        password_hash=sesion_service.hashear_password(PASSWORD_VALIDA),
        auth_provider="local",
        estado=estado,
        persona_id=persona_id,
    )


def crear_escenario(db_session) -> dict[str, object]:
    rol_familia = Rol(nombre="familia")
    rol_administracion = Rol(nombre="administración de notificaciones")
    rol_academico = Rol(nombre="gestión académica de notificaciones")
    db_session.add_all([rol_familia, rol_administracion, rol_academico])
    db_session.flush()

    personas = {
        "responsable_a": Persona(nombre="Ana", apellido="Ríos", dni="31000111"),
        "responsable_b": Persona(nombre="Beto", apellido="Sosa", dni="31000222"),
        "responsable_c": Persona(nombre="Carla", apellido="Paz", dni="31000333"),
        "alumno": Persona(nombre="Tiziano", apellido="Ríos", dni="51000111"),
    }
    db_session.add_all(personas.values())
    db_session.flush()

    familia_a = Familia(persona_id=personas["responsable_a"].id)
    familia_b = Familia(persona_id=personas["responsable_b"].id)
    familia_c = Familia(persona_id=personas["responsable_c"].id)
    alumno = Alumno(numero_legajo="A-2027-900", estado="activo", persona_id=personas["alumno"].id)
    db_session.add_all([familia_a, familia_b, familia_c, alumno])
    db_session.flush()

    db_session.add_all(
        [
            FamiliaAlumno(
                familia_id=familia_a.id,
                alumno_id=alumno.id,
                parentesco="madre",
                recibe_comunicaciones=True,
            ),
            FamiliaAlumno(
                familia_id=familia_b.id,
                alumno_id=alumno.id,
                parentesco="padre",
                recibe_comunicaciones=True,
            ),
            FamiliaAlumno(
                familia_id=familia_c.id,
                alumno_id=alumno.id,
                parentesco="tía",
                recibe_comunicaciones=False,
            ),
        ]
    )

    usuario_a = _usuario("familia.a@notificaciones.test", personas["responsable_a"].id)
    usuario_a2 = _usuario("familia.a2@notificaciones.test", personas["responsable_a"].id)
    usuario_a_inactivo = _usuario(
        "familia.a.inactivo@notificaciones.test", personas["responsable_a"].id, estado="inactivo"
    )
    usuario_b = _usuario("familia.b@notificaciones.test", personas["responsable_b"].id)
    usuario_c = _usuario("familia.c@notificaciones.test", personas["responsable_c"].id)
    usuario_admin = _usuario("administracion@notificaciones.test")
    usuario_academico = _usuario("academico@notificaciones.test")
    db_session.add_all(
        [
            usuario_a,
            usuario_a2,
            usuario_a_inactivo,
            usuario_b,
            usuario_c,
            usuario_admin,
            usuario_academico,
        ]
    )
    db_session.flush()

    for usuario in (usuario_a, usuario_a2, usuario_a_inactivo, usuario_b, usuario_c):
        db_session.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol_familia.id))
    db_session.add(UsuarioRol(usuario_id=usuario_admin.id, rol_id=rol_administracion.id))
    db_session.add(UsuarioRol(usuario_id=usuario_academico.id, rol_id=rol_academico.id))

    permisos = [
        Permiso(modulo=MODULO_ACADEMICO, accion=ACCION_CREAR),
        Permiso(modulo=MODULO_ACADEMICO, accion=ACCION_LEER),
        Permiso(modulo=MODULO_ACADEMICO, accion=ACCION_ACTUALIZAR),
        Permiso(modulo=MODULO_ACADEMICO, accion=ACCION_ELIMINAR),
        Permiso(
            modulo=MODULO_ACADEMICO, accion=ACCION_ACTUALIZAR, tipo_informacion="justificaciones"
        ),
    ]
    db_session.add_all(permisos)
    db_session.flush()
    for permiso in permisos:
        db_session.add(RolPermiso(rol_id=rol_academico.id, permiso_id=permiso.id))

    nivel = NivelEducativo(nombre="Primario")
    db_session.add(nivel)
    db_session.flush()
    anio = Anio(numero=4, nivel_educativo_id=nivel.id)
    db_session.add(anio)
    db_session.flush()
    division = Division(nombre="4° B", anio_id=anio.id)
    db_session.add(division)
    db_session.flush()
    inscripcion = Inscripcion(
        ciclo_lectivo="2027",
        fecha_inscripcion=date(2026, 10, 29),
        tipo="nueva",
        estado="activa",
        alumno_id=alumno.id,
        division_id=division.id,
    )
    db_session.add(inscripcion)
    db_session.add(MotivoJustificacion(nombre="enfermedad", activo=True))
    db_session.commit()

    return {
        "rol_familia": rol_familia,
        "rol_administracion": rol_administracion,
        "personas": personas,
        "familia_a": familia_a,
        "familia_b": familia_b,
        "familia_c": familia_c,
        "alumno": alumno,
        "inscripcion": inscripcion,
        "division": division,
        "usuario_a": usuario_a,
        "usuario_a2": usuario_a2,
        "usuario_a_inactivo": usuario_a_inactivo,
        "usuario_b": usuario_b,
        "usuario_c": usuario_c,
        "usuario_admin": usuario_admin,
        "usuario_academico": usuario_academico,
    }


@pytest.fixture()
def escenario_notificaciones(db_session):
    return crear_escenario(db_session)


@pytest.fixture()
def login(client):
    """Inicia sesión en el mismo cliente; el rol activo queda embebido en la cookie."""

    def _login(usuario: Usuario):
        respuesta = client.post(
            "/auth/login", json={"email": usuario.email, "password": PASSWORD_VALIDA}
        )
        assert respuesta.status_code == 200, respuesta.text
        return client

    return _login


@pytest.fixture()
def client_familia(client, escenario_notificaciones, login):
    return login(escenario_notificaciones["usuario_a"])


@pytest.fixture()
def client_academico(client, escenario_notificaciones, login):
    return login(escenario_notificaciones["usuario_academico"])


def crear_notificacion(
    db_session,
    *,
    usuario: Usuario,
    familia: Familia,
    alumno: Alumno,
    clave: str,
    tipo: str = TIPO_INASISTENCIA_REGISTRADA,
    titulo: str = "Inasistencia registrada",
    mensaje: str = "Se registró una inasistencia.",
    contexto: object | None = None,
    ambito: str = AMBITO_ACADEMICO,
    destino_tipo: str = DESTINO_ASISTENCIA,
    destino_id: uuid.UUID | None = None,
    created_at: datetime | None = None,
    leida_at: datetime | None = None,
) -> NotificacionInterna:
    """Carga directa para probar la bandeja sin depender de los productores académicos."""
    notificacion = NotificacionInterna(
        usuario_id=usuario.id,
        familia_id=familia.id,
        alumno_id=alumno.id,
        ambito=ambito,
        clave_hecho=clave,
        tipo=tipo,
        titulo=titulo,
        mensaje=mensaje,
        contexto=(
            contexto
            if contexto is not None
            else {
                "familia_id": str(familia.id),
                "alumno_id": str(alumno.id),
                "inscripcion_id": str(uuid.uuid4()),
                "fecha": "2027-03-15",
            }
        ),
        destino_tipo=destino_tipo,
        destino_id=destino_id or uuid.uuid4(),
        created_at=created_at or datetime.now(UTC).replace(tzinfo=None),
        leida_at=leida_at,
    )
    db_session.add(notificacion)
    db_session.commit()
    return notificacion
