"""Lecturas agregadas del módulo: resumen de la página de reglas, estadísticas por nodo y eventos
recientes para probar una regla. Todo con consultas agrupadas (sin N+1)."""

import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta

import sqlalchemy as sa
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.models import EventLog
from src.workflows.ejecuciones_service import resumen_evento
from src.workflows.models import CampoEvento, TipoEvento, WorkflowExecution, WorkflowRule
from src.workflows.schemas import (
    ConteoEstadosRead,
    EstadisticasNodoRead,
    EstadisticasReglaRead,
    EventoResumenRead,
    PuntoSerieRead,
    ResumenReglaRead,
    ResumenWorkflowsRead,
)

ESTADOS = ("exitoso", "fallido", "pendiente", "rechazado")
DIAS_SERIE_REGLA = 14
DIAS_FALLAS = 7


def _ahora(db: Session) -> datetime:
    # La hora de la base, que es la que guarda `WorkflowExecution.started_at`.
    return db.scalar(select(func.localtimestamp()))


def _sumar(conteo: ConteoEstadosRead, estado: str, cantidad: int) -> None:
    setattr(conteo, estado, getattr(conteo, estado) + cantidad)
    conteo.total += cantidad


def resumen_de_evento(
    evento: EventLog, tipo_evento_nombre: str, campos: list[CampoEvento]
) -> EventoResumenRead:
    """Solo los campos del catálogo del evento: nunca el payload crudo."""
    return EventoResumenRead(
        id=evento.id,
        timestamp=evento.timestamp,
        entidad=evento.entidad,
        estado=evento.estado,
        campos=resumen_evento(tipo_evento_nombre, evento.payload, campos),
    )


def eventos_recientes(
    db: Session, tipo_evento_id: uuid.UUID, limite: int = 20
) -> list[EventoResumenRead]:
    tipo_evento = db.get(TipoEvento, tipo_evento_id)
    if tipo_evento is None:
        return []
    campos = list(
        db.scalars(
            select(CampoEvento)
            .where(CampoEvento.tipo_evento_id == tipo_evento_id)
            .order_by(CampoEvento.nombre_interno)
        )
    )
    eventos = db.scalars(
        select(EventLog)
        .where(EventLog.tipo_evento_id == tipo_evento_id)
        .order_by(EventLog.timestamp.desc())
        .limit(limite)
    )
    return [resumen_de_evento(e, tipo_evento.nombre, campos) for e in eventos]


def estadisticas_regla(db: Session, regla_id: uuid.UUID, dias: int) -> EstadisticasReglaRead:
    desde = _ahora(db) - timedelta(days=dias)
    filas = db.execute(
        select(WorkflowExecution.workflow_nodo_id, WorkflowExecution.estado, func.count())
        .where(
            WorkflowExecution.workflow_rule_id == regla_id,
            WorkflowExecution.started_at >= desde,
        )
        .group_by(WorkflowExecution.workflow_nodo_id, WorkflowExecution.estado)
    )
    por_nodo: dict[uuid.UUID, EstadisticasNodoRead] = {}
    for nodo_id, estado, cantidad in filas:
        por_nodo.setdefault(nodo_id, EstadisticasNodoRead(workflow_nodo_id=nodo_id))
        setattr(por_nodo[nodo_id], estado, cantidad)
    return EstadisticasReglaRead(dias=dias, nodos=list(por_nodo.values()))


def resumen(db: Session, dias: int) -> ResumenWorkflowsRead:
    ahora = _ahora(db)
    hoy = ahora.date()
    primer_dia = hoy - timedelta(days=dias - 1)
    inicio_anterior = primer_dia - timedelta(days=dias)

    dia = func.date(WorkflowExecution.started_at, type_=sa.Date)
    por_dia = db.execute(
        select(dia, WorkflowExecution.estado, func.count())
        .where(
            WorkflowExecution.started_at >= datetime.combine(inicio_anterior, datetime.min.time())
        )
        .group_by(dia, WorkflowExecution.estado)
    ).all()
    actual, anterior = ConteoEstadosRead(), ConteoEstadosRead()
    serie: dict[date, PuntoSerieRead] = {
        hoy - timedelta(days=i): PuntoSerieRead(fecha=hoy - timedelta(days=i))
        for i in range(dias - 1, -1, -1)
    }
    for fecha, estado, cantidad in por_dia:
        fecha = _a_fecha(fecha)
        if fecha in serie:
            _sumar(serie[fecha], estado, cantidad)
            _sumar(actual, estado, cantidad)
        elif fecha < primer_dia:
            _sumar(anterior, estado, cantidad)

    desde_reglas = datetime.combine(
        hoy - timedelta(days=max(dias, DIAS_SERIE_REGLA) - 1), datetime.min.time()
    )
    por_regla = db.execute(
        select(
            WorkflowExecution.workflow_rule_id,
            dia,
            WorkflowExecution.estado,
            func.count(),
        )
        .where(WorkflowExecution.started_at >= desde_reglas)
        .group_by(WorkflowExecution.workflow_rule_id, dia, WorkflowExecution.estado)
    ).all()
    ultimas = dict(
        db.execute(
            select(
                WorkflowExecution.workflow_rule_id, func.max(WorkflowExecution.started_at)
            ).group_by(WorkflowExecution.workflow_rule_id)
        ).all()
    )
    conteos: dict[uuid.UUID, ConteoEstadosRead] = defaultdict(ConteoEstadosRead)
    series: dict[uuid.UUID, dict[date, int]] = defaultdict(lambda: defaultdict(int))
    fallas: dict[uuid.UUID, int] = defaultdict(int)
    for regla_id, fecha, estado, cantidad in por_regla:
        fecha = _a_fecha(fecha)
        if fecha >= primer_dia:
            _sumar(conteos[regla_id], estado, cantidad)
        series[regla_id][fecha] += cantidad
        if estado == "fallido" and fecha >= hoy - timedelta(days=DIAS_FALLAS - 1):
            fallas[regla_id] += cantidad

    reglas = db.execute(select(WorkflowRule.id, WorkflowRule.activo)).all()
    resultado = [
        ResumenReglaRead(
            workflow_rule_id=regla_id,
            ejecuciones=conteos.get(regla_id, ConteoEstadosRead()),
            serie=[
                series[regla_id].get(hoy - timedelta(days=i), 0)
                for i in range(DIAS_SERIE_REGLA - 1, -1, -1)
            ],
            ultima_ejecucion=ultimas.get(regla_id),
            fallas_7_dias=fallas.get(regla_id, 0),
            sin_disparos=bool(activo) and conteos.get(regla_id, ConteoEstadosRead()).total == 0,
        )
        for regla_id, activo in reglas
    ]
    return ResumenWorkflowsRead(
        dias=dias,
        actual=actual,
        anterior=anterior,
        serie_diaria=list(serie.values()),
        reglas=resultado,
        activas=sum(1 for _, activo in reglas if activo),
        inactivas=sum(1 for _, activo in reglas if not activo),
        con_errores=sum(1 for r in resultado if r.fallas_7_dias > 0),
    )


def _a_fecha(valor: object) -> date:
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    return date.fromisoformat(str(valor)[:10])
