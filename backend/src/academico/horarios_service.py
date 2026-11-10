"""Validación de superposición de horarios de materias-curso y docentes."""

import uuid
from collections.abc import Iterable
from datetime import time
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.academico.exceptions import HorarioDuplicado, HorarioSuperpuestoEnDivision
from src.academico.models import HorarioMateriaCurso, Materia, MateriaCurso

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
