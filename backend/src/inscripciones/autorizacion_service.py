"""Reglas de acceso por vínculo familiar para Inscripciones."""

import uuid

from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from src.auth.exceptions import PermisoDenegado
from src.familias_alumnos.models import Alumno, Familia, FamiliaAlumno
from src.inscripciones.models import SolicitudInscripcion


def filtro_solicitudes_de_familia(usuario_id: uuid.UUID, familia: Familia) -> ColumnElement[bool]:
    """Solicitudes propias: las creó el usuario, su persona es el contacto, o el aspirante ya
    está vinculado como alumno de la familia."""
    return or_(
        SolicitudInscripcion.usuario_id == usuario_id,
        SolicitudInscripcion.contacto_persona_id == familia.persona_id,
        SolicitudInscripcion.aspirante_persona_id.in_(
            select(Alumno.persona_id)
            .join(FamiliaAlumno, FamiliaAlumno.alumno_id == Alumno.id)
            .where(FamiliaAlumno.familia_id == familia.id)
        ),
    )


def verificar_acceso_a_solicitud(
    db: Session,
    solicitud: SolicitudInscripcion,
    *,
    usuario_id: uuid.UUID,
    familia: Familia,
) -> None:
    """Cortar con 403 si la solicitud no pertenece a la familia."""
    if solicitud.usuario_id == usuario_id:
        return
    if solicitud.contacto_persona_id == familia.persona_id:
        return
    vinculado = db.scalar(
        select(FamiliaAlumno.id)
        .join(Alumno, Alumno.id == FamiliaAlumno.alumno_id)
        .where(
            FamiliaAlumno.familia_id == familia.id,
            Alumno.persona_id == solicitud.aspirante_persona_id,
        )
        .limit(1)
    )
    if vinculado is None:
        raise PermisoDenegado("No tenés acceso a esta solicitud")
