"""Tests de generación y administración de facturas por alumno."""

from datetime import date
from decimal import Decimal

import pytest

from src.facturacion.exceptions import (
    ConceptoCobroInvalido,
    FacturaEnUso,
    FacturaNoEditable,
    MontoFacturaInvalido,
    ResponsableEconomicoNoVigente,
)
from src.facturacion.facturas_service import (
    actualizar_factura,
    crear_factura,
    eliminar_factura,
    listar_facturas,
)
from src.facturacion.models import ConceptoCobro, ResponsableEconomico
from src.facturacion.schemas import DetalleFacturaCreate, FacturaCreate, FacturaUpdate
from tests.inscripciones.factories import crear_escenario, crear_inscripcion_previa


def _crear_base_facturable(db_session):
    escenario = crear_escenario(db_session)
    inscripcion = crear_inscripcion_previa(db_session, escenario, estado="activa")
    concepto = ConceptoCobro(nombre="Matrícula", categoria="Escolar", activo=True)
    responsable = ResponsableEconomico(
        vigencia_desde=date(2027, 1, 1),
        alumno_id=escenario["alumno_id"],
        familia_id=escenario["familia_id"],
    )
    db_session.add_all([concepto, responsable])
    db_session.commit()
    return escenario, inscripcion, concepto, responsable


def _datos_factura(inscripcion_id, concepto_id, *, monto="125000.50"):
    return FacturaCreate(
        fecha_emision=date(2027, 3, 1),
        fecha_vencimiento=date(2027, 3, 10),
        inscripcion_id=inscripcion_id,
        detalles=[
            DetalleFacturaCreate(
                descripcion="Matrícula marzo",
                monto=Decimal(monto),
                concepto_cobro_id=concepto_id,
            )
        ],
    )


def test_crear_factura_calcula_total_y_cristaliza_responsable(db_session):
    _, inscripcion, concepto, responsable = _crear_base_facturable(db_session)

    factura = crear_factura(db_session, _datos_factura(inscripcion.id, concepto.id))

    assert factura.monto_total == Decimal("125000.50")
    assert factura.estado == "pendiente"
    assert factura.responsable_economico_id == responsable.id
    assert len(factura.detalles) == 1


def test_no_factura_sin_responsable_vigente(db_session):
    _, inscripcion, concepto, responsable = _crear_base_facturable(db_session)
    db_session.delete(responsable)
    db_session.commit()

    with pytest.raises(ResponsableEconomicoNoVigente):
        crear_factura(db_session, _datos_factura(inscripcion.id, concepto.id))


def test_no_factura_con_concepto_inactivo(db_session):
    _, inscripcion, concepto, _ = _crear_base_facturable(db_session)
    concepto.activo = False
    db_session.commit()

    with pytest.raises(ConceptoCobroInvalido):
        crear_factura(db_session, _datos_factura(inscripcion.id, concepto.id))


def test_no_factura_si_la_suma_supera_la_precision_de_base(db_session):
    _, inscripcion, concepto, _ = _crear_base_facturable(db_session)
    datos = _datos_factura(inscripcion.id, concepto.id, monto="6000000000.00")
    datos.detalles.append(
        DetalleFacturaCreate(
            descripcion="Segundo cargo",
            monto=Decimal("6000000000.00"),
            concepto_cobro_id=concepto.id,
        )
    )

    with pytest.raises(MontoFacturaInvalido):
        crear_factura(db_session, datos)


def test_actualizar_factura_recalcula_total(db_session):
    _, inscripcion, concepto, _ = _crear_base_facturable(db_session)
    factura = crear_factura(db_session, _datos_factura(inscripcion.id, concepto.id))

    actualizada = actualizar_factura(
        db_session,
        factura,
        FacturaUpdate(
            fecha_vencimiento=date(2027, 3, 15),
            detalles=[
                DetalleFacturaCreate(
                    descripcion="Matrícula actualizada",
                    monto=Decimal("130000.00"),
                    concepto_cobro_id=concepto.id,
                )
            ],
        ),
    )

    assert actualizada.fecha_vencimiento == date(2027, 3, 15)
    assert actualizada.monto_total == Decimal("130000.00")
    assert actualizada.detalles[0].descripcion == "Matrícula actualizada"


def test_no_modifica_ni_elimina_factura_pagada(db_session):
    _, inscripcion, concepto, _ = _crear_base_facturable(db_session)
    factura = crear_factura(db_session, _datos_factura(inscripcion.id, concepto.id))
    factura.estado = "pagada"
    db_session.commit()

    with pytest.raises(FacturaNoEditable):
        actualizar_factura(db_session, factura, FacturaUpdate(fecha_vencimiento=date(2027, 3, 15)))
    with pytest.raises(FacturaEnUso):
        eliminar_factura(db_session, factura)


def test_listar_facturas_filtra_por_alumno_y_pagina(db_session):
    escenario, inscripcion, concepto, _ = _crear_base_facturable(db_session)
    crear_factura(db_session, _datos_factura(inscripcion.id, concepto.id, monto="100.00"))
    crear_factura(db_session, _datos_factura(inscripcion.id, concepto.id, monto="200.00"))

    facturas, total = listar_facturas(
        db_session,
        pagina=1,
        tamanio=1,
        alumno_id=escenario["alumno_id"],
        estado="pendiente",
    )

    assert total == 2
    assert len(facturas) == 1
    assert facturas[0].detalles


def test_endpoints_exponen_crud_de_facturas(client_autenticado, db_session):
    _, inscripcion, concepto, responsable = _crear_base_facturable(db_session)
    payload = {
        "fecha_emision": "2027-03-01",
        "fecha_vencimiento": "2027-03-10",
        "inscripcion_id": str(inscripcion.id),
        "detalles": [
            {
                "descripcion": "Matrícula marzo",
                "monto": "125000.50",
                "concepto_cobro_id": str(concepto.id),
            }
        ],
    }

    creada = client_autenticado.post("/facturacion/facturas", json=payload)
    listado = client_autenticado.get("/facturacion/facturas")

    assert creada.status_code == 201
    assert creada.json()["responsable_economico_id"] == str(responsable.id)
    assert listado.status_code == 200
    assert listado.json()["total"] == 1
