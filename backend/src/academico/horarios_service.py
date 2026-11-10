"""Validación de superposición de horarios de materias-curso y docentes."""

import uuid
from collections.abc import Iterable
from datetime import time
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.academico.exceptions import (
    DocenteConHorarioSuperpuesto,
    HorarioDuplicado,
    HorarioSuperpuestoEnDivision,
)
from src.academico.models import (
    AsignacionDocente,
    Division,
    HorarioMateriaCurso,
    Materia,
    MateriaCurso,
)

DIAS_SEMANA = {
    1: "lunes",
    2: "martes",
    3: "miércoles",
    4: "jueves",
    5: "viernes",
    6: "sábado",
    7: "domingo",
}


class Franja(Protocol):
    """Cualquier objeto con día y rango horario (schema o modelo)."""

    @property
    def dia_semana(self) -> int: ...

    @property
    def hora_inicio(self) -> time: ...

    @property
    def hora_fin(self) -> time: ...


def franjas_se_superponen(a: Franja, b: Franja) -> bool:
    """Mismo día y rangos que se pisan. Franjas contiguas (8-9 y 9-10) no se superponen."""
    return (
        a.dia_semana == b.dia_semana and a.hora_inicio < b.hora_fin and a.hora_fin > b.hora_inicio
    )


def describir_franja(franja: Franja) -> str:
    return (
        f"{DIAS_SEMANA[franja.dia_semana]} de {franja.hora_inicio:%H:%M} a {franja.hora_fin:%H:%M}"
    )


def validar_franjas_propias(horarios: Iterable[Franja]) -> None:
    """Rechazar franjas del mismo pedido que se pisan entre sí, total o parcialmente."""
    lista = list(horarios)
    for i, franja in enumerate(lista):
        for otra in lista[i + 1 :]:
            if franjas_se_superponen(franja, otra):
                raise HorarioDuplicado()


def validar_horarios_division(
    db: Session,
    division_id: uuid.UUID,
    horarios: Iterable[Franja],
    excluir_materia_curso_id: uuid.UUID | None = None,
) -> None:
    """Rechazar franjas que se pisan con las de otra materia de la misma división."""
    nuevas = list(horarios)
    if not nuevas:
        return

    consulta = (
        select(HorarioMateriaCurso, Materia.nombre)
        .join(MateriaCurso, HorarioMateriaCurso.materia_curso_id == MateriaCurso.id)
        .join(Materia, MateriaCurso.materia_id == Materia.id)
        .where(MateriaCurso.division_id == division_id)
    )
    if excluir_materia_curso_id is not None:
        consulta = consulta.where(MateriaCurso.id != excluir_materia_curso_id)

    for existente, materia_nombre in db.execute(consulta):
        for nueva in nuevas:
            if franjas_se_superponen(nueva, existente):
                raise HorarioSuperpuestoEnDivision(
                    f"Se superpone con {materia_nombre}, {describir_franja(existente)}"
                )


def validar_horarios_docente(
    db: Session,
    docente_id: uuid.UUID,
    ciclo_lectivo: str,
    horarios: Iterable[Franja],
    excluir_materia_curso_id: uuid.UUID | None = None,
    excluir_asignacion_id: uuid.UUID | None = None,
) -> None:
    """Rechazar franjas que se pisan con otra materia-curso que el docente dicta en el ciclo.

    Dos docentes en la misma materia-curso (pareja pedagógica) no es conflicto: solo se
    comparan las asignaciones del propio docente.
    """
    nuevas = list(horarios)
    if not nuevas:
        return

    consulta = (
        select(HorarioMateriaCurso, Materia.nombre, Division.nombre)
        .join(MateriaCurso, HorarioMateriaCurso.materia_curso_id == MateriaCurso.id)
        .join(Materia, MateriaCurso.materia_id == Materia.id)
        .join(Division, MateriaCurso.division_id == Division.id)
        .join(AsignacionDocente, AsignacionDocente.materia_curso_id == MateriaCurso.id)
        .where(
            AsignacionDocente.docente_id == docente_id,
            AsignacionDocente.ciclo_lectivo == ciclo_lectivo,
        )
    )
    if excluir_materia_curso_id is not None:
        consulta = consulta.where(MateriaCurso.id != excluir_materia_curso_id)
    if excluir_asignacion_id is not None:
        consulta = consulta.where(AsignacionDocente.id != excluir_asignacion_id)

    for existente, materia_nombre, division_nombre in db.execute(consulta):
        for nueva in nuevas:
            if franjas_se_superponen(nueva, existente):
                franja = describir_franja(existente)
                raise DocenteConHorarioSuperpuesto(
                    f"Ya dicta {materia_nombre} en {division_nombre} el {franja}"
                )
