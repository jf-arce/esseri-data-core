"""Tests del catálogo configurable de conceptos de cobro."""

import uuid

import pytest

from src.facturacion.exceptions import ConceptoCobroDuplicado, ConceptoCobroEnUso
from src.facturacion.models import ReglaPenalidad
from src.facturacion.schemas import ConceptoCobroCreate, ConceptoCobroUpdate
from src.facturacion.service import (
    actualizar_concepto_cobro,
    crear_concepto_cobro,
    eliminar_concepto_cobro,
    listar_conceptos_cobro,
)


def _concepto(nombre: str = "Matrícula") -> ConceptoCobroCreate:
    return ConceptoCobroCreate(nombre=nombre, categoria="Escolar")


def test_crear_y_listar_conceptos_ordenados(db_session):
    crear_concepto_cobro(db_session, _concepto("Transporte"))
    concepto = crear_concepto_cobro(db_session, _concepto("Matrícula"))

    assert concepto.activo is True
    assert [item.nombre for item in listar_conceptos_cobro(db_session)] == [
        "Matrícula",
        "Transporte",
    ]


def test_no_duplica_conceptos_sin_importar_mayusculas(db_session):
    crear_concepto_cobro(db_session, _concepto("Matrícula"))

    with pytest.raises(ConceptoCobroDuplicado):
        crear_concepto_cobro(db_session, _concepto("matrícula"))


def test_actualizar_permite_dar_de_baja_logica(db_session):
    concepto = crear_concepto_cobro(db_session, _concepto())

    actualizado = actualizar_concepto_cobro(db_session, concepto, ConceptoCobroUpdate(activo=False))

    assert actualizado.activo is False
    assert actualizado.nombre == "Matrícula"


def test_no_elimina_concepto_referenciado_por_regla(db_session):
    concepto = crear_concepto_cobro(db_session, _concepto("Penalidad por mora"))
    db_session.add(
        ReglaPenalidad(
            desde_dia_vencido=1,
            hasta_dia_vencido=None,
            porcentaje=10,
            activo=True,
            concepto_cobro_id=concepto.id,
        )
    )
    db_session.commit()

    with pytest.raises(ConceptoCobroEnUso):
        eliminar_concepto_cobro(db_session, concepto)


def test_endpoints_del_catalogo(client_autenticado):
    creada = client_autenticado.post(
        "/facturacion/conceptos", json={"nombre": "Materiales", "categoria": "Escolar"}
    )

    assert creada.status_code == 201
    concepto_id = creada.json()["id"]
    actualizada = client_autenticado.put(
        f"/facturacion/conceptos/{concepto_id}", json={"activo": False}
    )
    listado = client_autenticado.get("/facturacion/conceptos")

    assert actualizada.status_code == 200
    assert actualizada.json()["activo"] is False
    assert listado.status_code == 200
    assert listado.json()[0]["id"] == concepto_id


def test_concepto_inexistente_devuelve_404(client_autenticado):
    respuesta = client_autenticado.get(f"/facturacion/conceptos/{uuid.uuid4()}")

    assert respuesta.status_code == 404
