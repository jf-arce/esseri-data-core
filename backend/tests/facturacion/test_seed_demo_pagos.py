"""Demo payments must have exactly one matching ledger credit."""

import importlib.util
import uuid
from datetime import date
from pathlib import Path
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from src.auth.models import Usuario
from src.facturacion.models import ConceptoCobro, MetodoPago, Movimiento, Pago
from src.inscripciones.models import Inscripcion
from tests.facturacion.test_portal_familia import _crear_escenario_facturacion


def _cargar_seed():
    path = Path(__file__).resolve().parents[3] / "database/seeds/04_seed_demo.py"
    spec = importlib.util.spec_from_file_location("demo_payment_seed", path)
    seed = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(seed)
    return seed


def _catalogos_demo(db_session):
    db_session.add_all(
        [
            ConceptoCobro(nombre="Cuota educativa", categoria="Escolar", activo=True),
            ConceptoCobro(nombre="Matrícula", categoria="Escolar", activo=True),
            MetodoPago(nombre="debito_directo", requiere_comprobante=False),
        ]
    )
    db_session.commit()


@pytest.mark.parametrize("existing_payment", [False, True])
def test_seed_payment_creates_credit_once(db_session, monkeypatch, existing_payment):
    seed = _cargar_seed()
    scenario = _crear_escenario_facturacion(db_session)
    _catalogos_demo(db_session)
    invoice = scenario["factura"]
    if existing_payment:
        payment = scenario["pago"]
        payment.referencia_transaccion = "DEMO-202603-001"
        payment.monto = invoice.monto_total
        for credit in db_session.scalars(
            select(Movimiento).where(Movimiento.pago_id == payment.id)
        ):
            db_session.delete(credit)
        db_session.commit()
    enrollment = db_session.get(Inscripcion, invoice.inscripcion_id)
    user = db_session.get(Usuario, scenario["pago"].usuario_registro_id)
    monkeypatch.setattr(seed, "generar_facturacion", lambda *args, **kwargs: None)

    for _ in range(2):
        seed._ensure_facturacion(db_session, user, [enrollment], date(2026, 4, 15))
        db_session.commit()
        payment = db_session.scalar(
            select(Pago).where(Pago.referencia_transaccion == "DEMO-202603-001")
        )
        assert payment is not None
        credits = list(
            db_session.scalars(select(Movimiento).where(Movimiento.pago_id == payment.id))
        )
        assert len(credits) == 1
        assert credits[0].tipo == "haber"
        assert credits[0].monto == payment.monto == invoice.monto_total
        assert credits[0].factura_id == invoice.id


def test_volver_a_cargar_no_pisa_una_factura_con_pago_parcial_ya_vencida(db_session, monkeypatch):
    # Si el seed la volviera a pendiente, el detector no reemite ese tramo y la penalidad
    # pendiente de ese evento ya no se podría aplicar.
    seed = _cargar_seed()
    scenario = _crear_escenario_facturacion(db_session)
    _catalogos_demo(db_session)
    invoice = scenario["factura"]
    enrollment = db_session.get(Inscripcion, invoice.inscripcion_id)
    user = db_session.get(Usuario, scenario["pago"].usuario_registro_id)
    monkeypatch.setattr(seed, "generar_facturacion", lambda *args, **kwargs: None)
    # Seis inscripciones sin factura delante: la del escenario cae en el grupo de pago parcial.
    inscripciones = [SimpleNamespace(id=uuid.uuid4()) for _ in range(6)] + [enrollment]

    seed._ensure_facturacion(db_session, user, inscripciones, date(2026, 4, 15))
    db_session.commit()
    assert invoice.estado == "pendiente"
    invoice.estado = "vencida"
    db_session.commit()

    seed._ensure_facturacion(db_session, user, inscripciones, date(2026, 4, 15))
    db_session.commit()

    db_session.refresh(invoice)
    assert invoice.estado == "vencida"
    payment = db_session.scalar(
        select(Pago).where(Pago.referencia_transaccion == "DEMO-202603-007")
    )
    assert payment is not None
    credits = db_session.scalars(select(Movimiento).where(Movimiento.pago_id == payment.id)).all()
    assert len(credits) == 1
