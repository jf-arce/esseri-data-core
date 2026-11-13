"""Tareas y ejecuciones de Workflows. Solo conteos: los títulos y descripciones son texto libre."""

from dataclasses import dataclass

from pydantic import BaseModel
from sqlalchemy import func, select

from src.asistente.herramientas_base import (
    ContextoHerramienta,
    Herramienta,
    ResultadoHerramienta,
    SinParametros,
    bloque_tabla,
)
from src.auth.constants import PERMISO_WORKFLOWS_LEER
from src.fechas import ahora_utc
from src.workflows.constants import ESTADOS_TAREA_ABIERTA
from src.workflows.models import Tarea, WorkflowExecution


@dataclass(frozen=True)
class ConteoTareas:
    alcance: str
    por_estado: dict[str, int]
    abiertas: int
    vencidas: int


def contar_tareas(contexto: ContextoHerramienta) -> ConteoTareas:
    """Todas las tareas con `workflows.leer`; sin él, solo las asignadas a la persona.

    Es la misma regla que la bandeja de `workflows/dependencies.py`.
    """
    ve_todas = contexto.tiene_permiso(PERMISO_WORKFLOWS_LEER)
    consulta = select(Tarea.estado, func.count(Tarea.id)).group_by(Tarea.estado)
    vencidas = select(func.count(Tarea.id)).where(
        Tarea.estado.in_(ESTADOS_TAREA_ABIERTA), Tarea.fecha_vencimiento < ahora_utc()
    )
    if not ve_todas:
        consulta = consulta.where(Tarea.usuario_id == contexto.usuario.id)
        vencidas = vencidas.where(Tarea.usuario_id == contexto.usuario.id)
    por_estado = {estado: cantidad for estado, cantidad in contexto.db.execute(consulta).all()}
    return ConteoTareas(
        alcance="todas" if ve_todas else "propias",
        por_estado=por_estado,
        abiertas=sum(por_estado.get(estado, 0) for estado in ESTADOS_TAREA_ABIERTA),
        vencidas=contexto.db.scalar(vencidas) or 0,
    )


def _tareas_y_ejecuciones(contexto: ContextoHerramienta, _: BaseModel) -> ResultadoHerramienta:
    tareas = contar_tareas(contexto)
    datos: dict[str, object] = {
        "fuente": "Workflows",
        "tareas_alcance": tareas.alcance,
        "tareas_por_estado": tareas.por_estado,
        "tareas_abiertas_vencidas": tareas.vencidas,
    }
    filas = [
        {"estado": estado, "cantidad": cantidad} for estado, cantidad in tareas.por_estado.items()
    ]
    bloques = [
        bloque_tabla(
            "Tareas por estado" + (" (todas)" if tareas.alcance == "todas" else " (propias)"),
            [
                {"clave": "estado", "etiqueta": "Estado", "tipo": "texto"},
                {"clave": "cantidad", "etiqueta": "Cantidad", "tipo": "numero"},
            ],
            filas,
            periodo="al día de hoy",
            fuente="Workflows",
        )
    ]
    if contexto.tiene_permiso(PERMISO_WORKFLOWS_LEER):
        ejecuciones = dict(
            contexto.db.execute(
                select(WorkflowExecution.estado, func.count(WorkflowExecution.id)).group_by(
                    WorkflowExecution.estado
                )
            ).all()
        )
        datos["ejecuciones_por_estado"] = ejecuciones
    else:
        datos["secciones_sin_permiso"] = ["ejecuciones"]
    return ResultadoHerramienta(para_llm=datos, bloques=bloques)


HERRAMIENTAS = [
    Herramienta(
        nombre="tareas_y_ejecuciones_pendientes",
        descripcion=(
            "Conteo de tareas por estado (las propias, o todas si el rol puede ver Workflows) y "
            "de ejecuciones de reglas por estado. No devuelve títulos ni descripciones."
        ),
        parametros=SinParametros,
        permisos=(),
        ejecutar=_tareas_y_ejecuciones,
        destino="tareas",
    )
]
