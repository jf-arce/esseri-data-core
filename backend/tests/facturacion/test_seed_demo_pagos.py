"""Demo payments must have exactly one matching ledger credit."""

import importlib.util
from datetime import date
from pathlib import Path

import pytest
from sqlalchemy import select

from src.auth.models import Usuario
from src.facturacion.models import ConceptoCobro, MetodoPago, Movimiento, Pago
from src.inscripciones.models import Inscripcion
from tests.facturacion.test_portal_familia import _crear_escenario_facturacion


@pytest.mark.parametrize("existing_payment", [False, True])
def test_seed_payment_creates_credit_once(db_session, monkeypatch, existing_payment):
    path = Path(__file__).resolve().parents[3] / "database/seeds/04_seed_demo.py"
    spec = importlib.util.spec_from_file_location("demo_payment_seed", path)
    seed = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(seed)
    scenario = _crear_escenario_facturacion(db_session)
    db_session.add_all(
        [
            ConceptoCobro(nombre="Cuota educativa", categoria="Escolar", activo=True),
            ConceptoCobro(nombre="Matrícula", categoria="Escolar", activo=True),
            MetodoPago(nombre="debito_directo", requiere_comprobante=False),
        ]
    )
    db_session.commit()
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
