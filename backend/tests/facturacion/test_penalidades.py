"""ABM de tramos de penalidad y prórrogas de vencimiento (#238)."""

import uuid
from datetime import date, timedelta

import pytest
from sqlalchemy import select

from src.auth.models import Usuario
from src.facturacion.models import (
    ConceptoCobro,
    ExcepcionVencimiento,
    Factura,
    ReglaPenalidad,
    ResponsableEconomico,
)
from src.facturacion.vencimientos_service import detectar_facturas_vencidas
from src.models import AuditLog
from src.workflows.acciones_vencimiento_service import ejecutar_aplicar_vencimiento
from src.workflows.eventos_service import emit_event
from src.workflows.models import WorkflowExecution, WorkflowRule
from tests.inscripciones.factories import crear_escenario, crear_inscripcion_previa

URL = "/facturacion/penalidades"


@pytest.fixture()
def concepto(db_session):
    concepto = ConceptoCobro(nombre="Penalidad por mora", activo=True)
    db_session.add(concepto)
    db_session.commit()
    return concepto


def _tramo(desde, hasta, porcentaje, concepto):
    return {
        "desde_dia_vencido": desde,
        "hasta_dia_vencido": hasta,
        "porcentaje": str(porcentaje),
        "concepto_cobro_id": str(concepto.id),
    }


def _crear(client, desde, hasta, porcentaje, concepto):
    return client.post(URL, json=_tramo(desde, hasta, porcentaje, concepto))


def test_alta_listado_y_auditoria(client_autenticado, db_session, concepto):
    _crear(client_autenticado, 16, 30, 30, concepto)
    respuesta = _crear(client_autenticado, 6, 15, 20, concepto)

    assert respuesta.status_code == 201
    assert respuesta.json()["activo"] is True
    listado = client_autenticado.get(URL).json()
    assert [t["desde_dia_vencido"] for t in listado] == [6, 16]
    assert db_session.scalar(select(AuditLog).where(AuditLog.entidad == "REGLA_PENALIDAD"))


@pytest.mark.parametrize(("desde", "hasta"), [(10, 20), (1, 6), (15, 15), (0, None)])
def test_rechaza_tramos_superpuestos(client_autenticado, concepto, desde, hasta):
    _crear(client_autenticado, 6, 15, 20, concepto)

    respuesta = _crear(client_autenticado, desde, hasta, 30, concepto)

    assert respuesta.status_code == 409
    assert "superpone" in respuesta.json()["detail"]


def test_tramo_abierto_choca_con_cualquiera_posterior(client_autenticado, concepto):
    _crear(client_autenticado, 16, None, 30, concepto)

    assert _crear(client_autenticado, 40, 50, 10, concepto).status_code == 409
    assert _crear(client_autenticado, 6, 15, 20, concepto).status_code == 201


def test_hasta_menor_que_desde_y_porcentaje_fuera_de_rango(client_autenticado, concepto):
    assert _crear(client_autenticado, 10, 5, 20, concepto).status_code == 422
    assert _crear(client_autenticado, 6, 15, 120, concepto).status_code == 422


def test_concepto_inactivo_se_rechaza(client_autenticado, db_session, concepto):
    concepto.activo = False
    db_session.commit()

    assert _crear(client_autenticado, 6, 15, 20, concepto).status_code == 422


def test_editar_valida_superposicion_sin_chocar_consigo_mismo(client_autenticado, concepto):
    primero = _crear(client_autenticado, 6, 15, 20, concepto).json()
    _crear(client_autenticado, 16, 30, 30, concepto)

    propio = client_autenticado.put(f"{URL}/{primero['id']}", json=_tramo(6, 14, 25, concepto))
    choca = client_autenticado.put(f"{URL}/{primero['id']}", json=_tramo(6, 20, 25, concepto))

    assert propio.status_code == 200
    assert propio.json()["porcentaje"] == "25.00"
    assert choca.status_code == 409


def test_baja_logica_y_reactivacion_valida_superposicion(client_autenticado, concepto):
    viejo = _crear(client_autenticado, 6, 15, 20, concepto).json()
    baja = client_autenticado.patch(f"{URL}/{viejo['id']}/estado", json={"activo": False})
    assert baja.status_code == 200
    assert baja.json()["activo"] is False
    # Con el viejo inactivo, otro tramo puede ocupar esos días.
    assert _crear(client_autenticado, 1, 10, 15, concepto).status_code == 201

    reactivar = client_autenticado.patch(f"{URL}/{viejo['id']}/estado", json={"activo": True})

    assert reactivar.status_code == 409
    assert len(client_autenticado.get(URL).json()) == 2


def test_tramo_inexistente_es_404(client_autenticado, concepto):
    respuesta = client_autenticado.put(f"{URL}/{uuid.uuid4()}", json=_tramo(6, 15, 20, concepto))

    assert respuesta.status_code == 404


def test_solo_lectura_ve_pero_no_modifica(client_solo_lectura, db_session, concepto):
    regla = ReglaPenalidad(
        desde_dia_vencido=6, porcentaje=20, activo=True, concepto_cobro_id=concepto.id
    )
    db_session.add(regla)
    db_session.commit()

    assert client_solo_lectura.get(URL).status_code == 200
    assert _crear(client_solo_lectura, 20, 30, 30, concepto).status_code == 403
    assert (
        client_solo_lectura.patch(f"{URL}/{regla.id}/estado", json={"activo": False}).status_code
        == 403
    )


# --- Prórrogas de vencimiento ---


@pytest.fixture()
def factura_vencida(db_session, tipo_factura_vencida):
    """Factura vencida hace 10 días, de una familia sin prórrogas."""
    escenario = crear_escenario(db_session)
    inscripcion = crear_inscripcion_previa(db_session, escenario, estado="activa")
    responsable = ResponsableEconomico(
        vigencia_desde=date.today() - timedelta(days=90),
        alumno_id=escenario["alumno_id"],
        familia_id=escenario["familia_id"],
    )
    db_session.add(responsable)
    db_session.flush()
    factura = Factura(
        fecha_emision=date.today() - timedelta(days=40),
        fecha_vencimiento=date.today() - timedelta(days=10),
        monto_total=1000,
        inscripcion_id=inscripcion.id,
        responsable_economico_id=responsable.id,
    )
    db_session.add(factura)
    db_session.commit()
    return factura, escenario["familia_id"]


def _url_familia(familia_id):
    return f"/facturacion/familias/{familia_id}/excepciones-vencimiento"


def _otorgar(client, familia_id, dias=5):
    fecha = (date.today() + timedelta(days=dias)).isoformat()
    return client.post(
        _url_familia(familia_id),
        json={"fecha_vencimiento_excepcional": fecha, "motivo": "  Acuerdo con Dirección "},
    )


def test_otorgar_y_listar_prorroga(client_autenticado, db_session, factura_vencida):
    _, familia_id = factura_vencida

    respuesta = _otorgar(client_autenticado, familia_id)

    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["motivo"] == "Acuerdo con Dirección"
    assert cuerpo["anulada_at"] is None
    assert cuerpo["usuario_id"] == str(
        db_session.scalar(select(Usuario.id).where(Usuario.email == "facturacion@esseri.edu.ar"))
    )
    assert len(client_autenticado.get(_url_familia(familia_id)).json()) == 1


def test_prorroga_de_familia_inexistente_es_404(client_autenticado, tipo_factura_vencida):
    assert _otorgar(client_autenticado, uuid.uuid4()).status_code == 404


def test_motivo_obligatorio(client_autenticado, factura_vencida):
    _, familia_id = factura_vencida

    respuesta = client_autenticado.post(
        _url_familia(familia_id),
        json={"fecha_vencimiento_excepcional": date.today().isoformat(), "motivo": "  "},
    )

    assert respuesta.status_code == 422


def test_anular_marca_y_no_se_anula_dos_veces(client_autenticado, factura_vencida):
    _, familia_id = factura_vencida
    excepcion_id = _otorgar(client_autenticado, familia_id).json()["id"]
    url = f"/facturacion/excepciones-vencimiento/{excepcion_id}/anular"

    primera = client_autenticado.post(url)
    segunda = client_autenticado.post(url)

    assert primera.status_code == 200
    assert primera.json()["anulada_at"] is not None
    assert primera.json()["usuario_anulacion_id"] is not None
    assert segunda.status_code == 409
    # Sigue en el listado, como anulada: no se borra.
    assert client_autenticado.get(_url_familia(familia_id)).json()[0]["anulada_at"]


def test_anular_inexistente_es_404(client_autenticado):
    url = f"/facturacion/excepciones-vencimiento/{uuid.uuid4()}/anular"

    assert client_autenticado.post(url).status_code == 404


def test_solo_lectura_no_otorga_ni_anula(client_solo_lectura, factura_vencida):
    _, familia_id = factura_vencida

    assert client_solo_lectura.get(_url_familia(familia_id)).status_code == 200
    assert _otorgar(client_solo_lectura, familia_id).status_code == 403


def _vencer(db, factura, tipo_factura_vencida):
    regla = WorkflowRule(
        nombre="Vencer",
        condicion={},
        tipo_accion="aplicar_vencimiento",
        accion_config={},
        criticidad="media",
        requiere_aprobacion_humana=False,
        activo=True,
        tipo_evento_id=tipo_factura_vencida.id,
    )
    db.add(regla)
    db.commit()
    evento = emit_event(
        db,
        tipo="factura.vencida",
        entidad="factura",
        entidad_id=factura.id,
        payload={"dias_vencido": 10, "monto_deuda": 1000, "nombre_familia": "Cabral"},
    )
    db.commit()
    return ejecutar_aplicar_vencimiento(db, regla, evento, WorkflowExecution())


@pytest.mark.parametrize("anulada", [False, True])
def test_aplicar_vencimiento_ignora_prorrogas_anuladas(
    client_autenticado, db_session, factura_vencida, tipo_factura_vencida, anulada
):
    factura, familia_id = factura_vencida
    excepcion_id = _otorgar(client_autenticado, familia_id).json()["id"]
    if anulada:
        client_autenticado.post(f"/facturacion/excepciones-vencimiento/{excepcion_id}/anular")

    _vencer(db_session, factura, tipo_factura_vencida)

    db_session.refresh(factura)
    assert factura.estado == ("vencida" if anulada else "pendiente")


@pytest.mark.parametrize("anulada", [False, True])
def test_deteccion_ignora_prorrogas_anuladas(
    client_autenticado, db_session, factura_vencida, anulada
):
    factura, familia_id = factura_vencida
    # Fechas fijas: la detección solo cuenta prórrogas del mismo mes que el vencimiento.
    factura.fecha_emision = date(2027, 2, 25)
    factura.fecha_vencimiento = date(2027, 3, 5)
    db_session.add(
        excepcion := ExcepcionVencimiento(
            fecha_vencimiento_excepcional=date(2027, 3, 20),
            familia_id=familia_id,
            usuario_id=db_session.scalar(select(Usuario.id)),
            motivo="Acuerdo",
        )
    )
    db_session.commit()
    if anulada:
        client_autenticado.post(f"/facturacion/excepciones-vencimiento/{excepcion.id}/anular")

    resumen = detectar_facturas_vencidas(db_session, fecha_actual=date(2027, 3, 10))

    assert resumen.eventos_emitidos == (1 if anulada else 0)
