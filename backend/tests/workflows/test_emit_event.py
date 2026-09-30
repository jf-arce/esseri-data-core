import logging
import uuid
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import select

from src.models import EventLog
from src.workflows.exceptions import TipoEventoNoRegistrado
from src.workflows.service import emit_event


def test_evento_de_sistema_queda_pendiente(db_session, tipo_factura_vencida):
    entidad_id = uuid.uuid4()

    evento = emit_event(
        db_session,
        tipo="factura.vencida",
        entidad="factura",
        entidad_id=entidad_id,
        payload={"dias_vencido": 6, "monto_deuda": 1000},
    )

    assert evento.actor_tipo == "sistema"
    assert evento.usuario_id is None
    assert evento.estado == "pendiente"
    assert evento.tipo_evento_id == tipo_factura_vencida.id
    assert evento.entidad_id == entidad_id


def test_evento_con_usuario_es_de_actor_usuario(
    db_session, tipo_factura_vencida, usuario_workflows
):
    evento = emit_event(
        db_session,
        tipo="factura.vencida",
        entidad="factura",
        entidad_id=uuid.uuid4(),
        payload={"dias_vencido": 1, "monto_deuda": 1},
        usuario_id=usuario_workflows.id,
    )

    assert evento.actor_tipo == "usuario"
    assert evento.usuario_id == usuario_workflows.id


def test_tipo_no_registrado_falla(db_session):
    with pytest.raises(TipoEventoNoRegistrado):
        emit_event(db_session, tipo="pago.rechazado", entidad="pago", entidad_id=uuid.uuid4())


def test_payload_se_serializa_a_json(db_session, tipo_factura_vencida):
    evento = emit_event(
        db_session,
        tipo="factura.vencida",
        entidad="factura",
        entidad_id=uuid.uuid4(),
        payload={"dias_vencido": 6, "monto_deuda": Decimal("1500.50"), "fecha": date(2026, 9, 6)},
    )
    db_session.commit()
    db_session.expire_all()

    guardado = db_session.get(EventLog, evento.id)
    assert guardado is not None
    assert guardado.payload == {"dias_vencido": 6, "monto_deuda": 1500.5, "fecha": "2026-09-06"}


def test_campo_faltante_loggea_warning_y_registra_igual(db_session, tipo_factura_vencida, caplog):
    with caplog.at_level(logging.WARNING, logger="src.workflows.service"):
        evento = emit_event(
            db_session,
            tipo="factura.vencida",
            entidad="factura",
            entidad_id=uuid.uuid4(),
            payload={"dias_vencido": 6},
        )

    assert "monto_deuda" in caplog.text
    assert evento.id is not None


def test_no_hace_commit(db_session, tipo_factura_vencida):
    emit_event(db_session, tipo="factura.vencida", entidad="factura", entidad_id=uuid.uuid4())
    db_session.rollback()

    assert db_session.scalars(select(EventLog)).all() == []
