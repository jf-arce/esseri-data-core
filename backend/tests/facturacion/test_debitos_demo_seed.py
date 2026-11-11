"""Opt-in demo dataset for automatic debit collections: bounded, idempotent and isolated."""

import importlib.util
from datetime import date
from pathlib import Path

from sqlalchemy import select

from src.facturacion.models import (
    DebitoCobranza,
    Factura,
    FacturaCobranzaDemo,
    LoteCobranza,
)
from src.models import Persona
from tests.facturacion.test_cobranzas_lotes import BASE


def _cargar_seed():
    path = Path(__file__).resolve().parents[3] / "database/seeds/07_seed_debitos_demo.py"
    spec = importlib.util.spec_from_file_location("debitos_demo_seed", path)
    seed = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(seed)
    return seed


def _conteos(db_session):
    return (
        db_session.query(Factura).count(),
        db_session.query(FacturaCobranzaDemo).count(),
        db_session.query(LoteCobranza).count(),
        db_session.query(DebitoCobranza).count(),
    )


def test_seed_crea_dataset_acotado_e_idempotente(db_session):
    seed = _cargar_seed()
    ajeno = Persona(nombre="Fuera", apellido="Del Seed", dni="99999999")
    db_session.add(ajeno)
    db_session.commit()

    seed.seed(db_session)
    db_session.commit()
    primeros = _conteos(db_session)

    assert primeros[1] == 500
    assert primeros[2] == 2
    assert primeros[3] == 32
    assert db_session.get(Persona, ajeno.id) is not None

    lote_exportado = db_session.scalar(
        select(LoteCobranza).where(LoteCobranza.estado == "exportado")
    )
    lote_liberado = db_session.scalar(
        select(LoteCobranza).where(LoteCobranza.estado == "liberado")
    )
    assert lote_exportado is not None and lote_exportado.codigo == "LD-2026-11-001"
    assert lote_liberado is not None and lote_liberado.codigo == "LD-2026-10-001"
    reservados = list(
        db_session.scalars(
            select(DebitoCobranza).where(DebitoCobranza.lote_id == lote_exportado.id)
        )
    )
    liberados = list(
        db_session.scalars(
            select(DebitoCobranza).where(DebitoCobranza.lote_id == lote_liberado.id)
        )
    )
    assert len(reservados) == 12
    assert all(debito.reserva_activa for debito in reservados)
    assert len(liberados) == 20
    assert all(not debito.reserva_activa for debito in liberados)
    assert lote_liberado.motivo_liberacion
    assert lote_liberado.liberado_at is not None

    filas = list(db_session.scalars(select(FacturaCobranzaDemo)))
    assert {fila.medio for fila in filas} == {"cbu", "tarjeta"}
    assert {fila.periodo for fila in filas} == {"2026-11", "2026-10"}
    assert "numero" in {columna.name for columna in FacturaCobranzaDemo.__table__.columns}
    vencimientos = {factura.fecha_vencimiento for factura in db_session.scalars(select(Factura))}
    assert date(2026, 11, 10) in vencimientos

    reservadas_ids = {debito.factura_id for debito in reservados}
    elegibles_principal = [
        fila
        for fila in filas
        if fila.periodo == "2026-11" and fila.factura_id not in reservadas_ids
    ]
    assert len(elegibles_principal) == 438

    seed.seed(db_session)
    db_session.commit()
    assert _conteos(db_session) == primeros
    assert db_session.get(Persona, ajeno.id) is not None


def test_seed_permite_exportar_las_438_facturas_del_periodo(client_autenticado, db_session):
    seed = _cargar_seed()
    seed.seed(db_session)
    db_session.commit()
    filtros = {"periodo": "2026-11", "estado": "pendientes_sin_lote"}
    resumen = client_autenticado.post(
        BASE + "/resumen-seleccion",
        json={
            "seleccion": {
                "modo": "filtrados",
                "factura_ids": [],
                "filtros": filtros,
                "excluir_ids": [],
            }
        },
    )
    assert resumen.status_code == 200, resumen.text
    assert resumen.json()["cantidad"] == 438
    assert resumen.json()["ocultas_en_lote"] == 12

    lote = client_autenticado.post(
        BASE,
        json={
            "seleccion": {
                "modo": "filtrados",
                "factura_ids": [],
                "filtros": filtros,
                "excluir_ids": [],
            },
            "periodo": "2026-11",
        },
    )
    assert lote.status_code == 201, lote.text
    cuerpo = lote.json()
    assert cuerpo["cantidad_facturas"] == 438
    assert len(cuerpo["items"]) == 438
    lineas = cuerpo["solicitud"]["contenido"].splitlines()
    assert sum(linea.startswith("D;") for linea in lineas) == 438

    respuesta = client_autenticado.post(
        f"{BASE}/{cuerpo['id']}/respuesta", json={"rechazos_cantidad": 0}
    )
    assert respuesta.status_code == 200, respuesta.text
    texto = respuesta.json()["contenido"]
    revision = client_autenticado.post(BASE + "/previsualizar", json={"contenido": texto})
    assert revision.status_code == 200, revision.text
    assert revision.json()["resumen"]["procesados"]["cantidad"] == 438
    assert revision.json()["total"] == 438
