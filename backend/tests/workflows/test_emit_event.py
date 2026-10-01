import logging
import uuid
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import select

from src.models import EventLog
from src.workflows.eventos_service import coaccionar_valor, emit_event
from src.workflows.exceptions import EntidadDeEventoInvalida, TipoEventoNoRegistrado


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
    with caplog.at_level(logging.WARNING, logger="src.workflows.eventos_service"):
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


def test_entidad_distinta_de_la_canonica_falla(db_session, tipo_factura_vencida):
    with pytest.raises(EntidadDeEventoInvalida):
        emit_event(db_session, tipo="factura.vencida", entidad="tarea", entidad_id=uuid.uuid4())

    assert db_session.scalars(select(EventLog)).all() == []


def test_campo_de_tipo_equivocado_loggea_warning_y_registra_igual(
    db_session, tipo_factura_vencida, caplog
):
    with caplog.at_level(logging.WARNING, logger="src.workflows.eventos_service"):
        evento = emit_event(
            db_session,
            tipo="factura.vencida",
            entidad="factura",
            entidad_id=uuid.uuid4(),
            payload={"dias_vencido": "seis", "monto_deuda": True},
        )

    assert "tipo equivocado" in caplog.text
    assert "dias_vencido" in caplog.text and "monto_deuda" in caplog.text
    assert evento.id is not None


@pytest.mark.parametrize(
    ("tipo_dato", "valor"),
    [
        ("numero", None),
        ("numero", True),
        ("numero", "6"),
        ("numero", float("nan")),
        ("fecha", "no es fecha"),
        ("fecha", 20260906),
        ("texto", 5),
        ("texto", None),
    ],
)
def test_coaccionar_valor_rechaza_tipos_invalidos(tipo_dato, valor):
    with pytest.raises(ValueError):
        coaccionar_valor(tipo_dato, valor)


def test_coaccionar_valor_acepta_los_tipos_declarados():
    assert coaccionar_valor("numero", 6) == Decimal(6)
    assert coaccionar_valor("numero", 1500.5) == Decimal("1500.5")
    assert coaccionar_valor("fecha", "2026-09-06") == date(2026, 9, 6)
    assert coaccionar_valor("texto", "hola") == "hola"


def test_coaccionar_valor_no_incluye_el_valor_en_el_mensaje():
    with pytest.raises(ValueError) as numero:
        coaccionar_valor("numero", "DNI 30.123.456")
    with pytest.raises(ValueError) as fecha:
        coaccionar_valor("fecha", "nació el 3 de mayo")
    with pytest.raises(ValueError) as texto:
        coaccionar_valor("texto", 30123456)

    for error in (numero, fecha, texto):
        assert "30" not in str(error.value) and "mayo" not in str(error.value)
    assert "str" in str(numero.value)
