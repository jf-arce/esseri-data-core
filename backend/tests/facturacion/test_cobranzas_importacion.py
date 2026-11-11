"""Durable review and all-or-nothing confirmation for demo collection responses."""

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import select

from src.facturacion import facturas_service
from src.facturacion import formato_cobranza_simulada as formato
from src.facturacion.models import (
    DebitoCobranza,
    Factura,
    ImportacionCobranza,
    ImportacionCobranzaDetalle,
    Movimiento,
    Pago,
)
from src.models import AuditLog, EventLog
from tests.facturacion.conftest import crear_catalogo_evento_pago_registrado
from tests.facturacion.test_cobranzas_lotes import (
    BASE,
    crear_factura_demo,
    exportar,
)

METODO_DEMO = uuid.UUID("e55e2100-0000-4000-8000-000000000001")


def respuesta(client, lote, *, rechazar=None, rechazos_cantidad=None):
    cuerpo = {"rechazar_referencias": [str(r) for r in (rechazar or [])]}
    if rechazos_cantidad is not None:
        cuerpo["rechazos_cantidad"] = rechazos_cantidad
    respuesta = client.post(f"{BASE}/{lote['id']}/respuesta", json=cuerpo)
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()["contenido"]


def preview(client, contenido):
    return client.post(BASE + "/previsualizar", json={"contenido": contenido})


def confirmar(client, importacion_id, *, revisada=True):
    return client.post(
        BASE + "/confirmar",
        json={"importacion_id": str(importacion_id), "revision_confirmada": revisada},
    )


def _lote_con_facturas(client, db_session, cantidad, **kwargs):
    facturas = [
        crear_factura_demo(db_session, indice, numero=f"F-{indice:04d}", **kwargs)
        for indice in range(1, cantidad + 1)
    ]
    respuesta_lote = exportar(client, [factura.id for factura in facturas])
    assert respuesta_lote.status_code == 201, respuesta_lote.text
    return facturas, respuesta_lote.json()


def _conteos(db_session):
    return {
        "pagos": db_session.query(Pago).count(),
        "haber": db_session.query(Movimiento).filter_by(tipo="haber").count(),
        "eventos": db_session.query(EventLog).count(),
        "auditoria_pago": db_session.query(AuditLog).filter_by(entidad="PAGO").count(),
    }


def test_previsualizar_persiste_revision_sin_escribir_financiero(client_autenticado, db_session):
    facturas, lote = _lote_con_facturas(client_autenticado, db_session, 1)
    texto = respuesta(client_autenticado, lote)

    antes = _conteos(db_session)
    preview_respuesta = preview(client_autenticado, texto)

    assert preview_respuesta.status_code == 200, preview_respuesta.text
    cuerpo = preview_respuesta.json()
    assert cuerpo["id"] is not None
    assert cuerpo["lote_id"] == lote["id"]
    assert cuerpo["lote_codigo"] == lote["codigo"]
    assert cuerpo["estado"] == "en_revision"
    assert len(cuerpo["archivo_hash"]) == 64
    assert cuerpo["errores"] == []
    assert cuerpo["puede_confirmar"] is True
    assert cuerpo["resumen"] == {
        "procesados": {"cantidad": 1, "importe": "100.00"},
        "cobrados": {"cantidad": 1, "importe": "100.00"},
        "rechazados": {"cantidad": 0, "importe": "0.00"},
        "errores": {"cantidad": 0, "importe": "0.00"},
    }
    assert cuerpo["total"] == 1
    assert cuerpo["items"][0]["linea"] == 2
    assert cuerpo["items"][0]["referencia"]
    assert cuerpo["items"][0]["factura_id"] == str(facturas[0].id)
    assert cuerpo["items"][0]["numero_factura"] == "F-0001"
    assert cuerpo["items"][0]["alumno_nombre"] == "Demo, Alumno1"
    assert cuerpo["items"][0]["resultado"] == formato.COBRADO
    assert cuerpo["items"][0]["estado"] == "listo"
    assert cuerpo["items"][0]["pago_id"] is None

    assert _conteos(db_session) == antes
    assert db_session.query(ImportacionCobranza).count() == 1
    assert db_session.query(ImportacionCobranzaDetalle).count() == 1
    assert db_session.query(DebitoCobranza).one().resultado_hash is None
    assert db_session.get(Factura, facturas[0].id).estado == "pendiente"

    from src.facturacion.models import LoteCobranza

    assert db_session.get(LoteCobranza, uuid.UUID(lote["id"])).estado == "en_revision"


def test_confirmar_exige_revision_confirmada(client_autenticado, db_session):
    _, lote = _lote_con_facturas(client_autenticado, db_session, 1)
    texto = respuesta(client_autenticado, lote)
    importacion = preview(client_autenticado, texto).json()

    respuesta_sin_checkbox = confirmar(
        client_autenticado, importacion["id"], revisada=False
    )

    assert respuesta_sin_checkbox.status_code == 422
    assert db_session.query(Pago).count() == 0
    assert db_session.query(DebitoCobranza).one().resultado_hash is None


def test_confirmar_aplica_cobros_y_rechazos_en_una_sola_transaccion(
    client_autenticado, db_session
):
    crear_catalogo_evento_pago_registrado(db_session)
    facturas, lote = _lote_con_facturas(client_autenticado, db_session, 3)
    texto = respuesta(client_autenticado, lote, rechazos_cantidad=1)
    revision = preview(client_autenticado, texto).json()
    assert revision["resumen"] == {
        "procesados": {"cantidad": 3, "importe": "300.00"},
        "cobrados": {"cantidad": 2, "importe": "200.00"},
        "rechazados": {"cantidad": 1, "importe": "100.00"},
        "errores": {"cantidad": 0, "importe": "0.00"},
    }

    confirmado = confirmar(client_autenticado, revision["id"])

    assert confirmado.status_code == 200, confirmado.text
    cuerpo = confirmado.json()
    assert cuerpo["estado"] == "confirmada"
    assert cuerpo["puede_confirmar"] is False
    assert cuerpo["resumen"] == revision["resumen"]
    todos = client_autenticado.get(
        f"{BASE}/importaciones/{revision['id']}", params={"resultado": "todos"}
    ).json()
    estados = {item["estado"] for item in todos["items"]}
    assert estados == {"aplicado", "rechazado"}
    assert sum(item["estado"] == "aplicado" for item in todos["items"]) == 2
    assert db_session.query(Pago).count() == 2
    assert db_session.query(Movimiento).filter_by(tipo="haber").count() == 2
    assert db_session.query(EventLog).filter_by(entidad="pago").count() == 2
    assert db_session.query(AuditLog).filter_by(entidad="PAGO").count() == 2

    debitos = list(db_session.scalars(select(DebitoCobranza)))
    assert all(debito.reserva_activa is False for debito in debitos)
    assert all(debito.resultado is not None for debito in debitos)
    assert all(debito.resultado_hash is not None for debito in debitos)
    cobrados = [debito for debito in debitos if debito.pago_id is not None]
    rechazados = [debito for debito in debitos if debito.pago_id is None]
    assert len(cobrados) == 2 and len(rechazados) == 1
    assert rechazados[0].resultado == formato.RECHAZADO

    from src.facturacion.models import LoteCobranza

    assert db_session.get(LoteCobranza, uuid.UUID(lote["id"])).estado == "pagos_registrados"
    assert db_session.query(ImportacionCobranza).one().estado == "confirmada"


def test_archivo_mezclado_con_error_no_aplica_ningun_pago(client_autenticado, db_session):
    crear_catalogo_evento_pago_registrado(db_session)
    facturas, lote = _lote_con_facturas(client_autenticado, db_session, 2)
    base = respuesta(client_autenticado, lote)
    lote_id, filas = formato.leer_respuesta(base)
    filas[0] = formato.RespuestaDetalle(
        filas[0].referencia, formato.COBRADO, Decimal("99.00"), filas[0].fecha, "", ""
    )
    texto = formato.generar_respuesta(lote_id, date.today(), filas)

    revision = preview(client_autenticado, texto).json()
    assert revision["puede_confirmar"] is False
    assert revision["resumen"]["errores"] == {"cantidad": 1, "importe": "99.00"}
    assert {item["estado"] for item in revision["items"]} == {"listo", "error"}

    antes = _conteos(db_session)
    resultado = confirmar(client_autenticado, revision["id"])

    assert resultado.status_code == 200
    assert resultado.json()["estado"] == "en_revision"
    assert resultado.json()["puede_confirmar"] is False
    assert _conteos(db_session) == antes
    assert db_session.query(Pago).count() == 0
    assert {debito.resultado_hash for debito in db_session.scalars(select(DebitoCobranza))} == {
        None
    }
    assert db_session.query(ImportacionCobranza).one().estado == "en_revision"
    assert db_session.get(Factura, facturas[0].id).estado == "pendiente"


def test_reimportar_el_mismo_archivo_recupera_confirmado_sin_duplicar(
    client_autenticado, db_session
):
    crear_catalogo_evento_pago_registrado(db_session)
    _, lote = _lote_con_facturas(client_autenticado, db_session, 1)
    texto = respuesta(client_autenticado, lote)
    revision = preview(client_autenticado, texto).json()
    confirmado = confirmar(client_autenticado, revision["id"]).json()
    assert confirmado["estado"] == "confirmada"
    conteos = _conteos(db_session)

    recuperado = preview(client_autenticado, texto).json()
    assert recuperado["id"] == revision["id"]
    assert recuperado["estado"] == "confirmada"
    assert recuperado["resumen"] == confirmado["resumen"]

    repetido = confirmar(client_autenticado, revision["id"]).json()
    assert repetido["id"] == revision["id"]
    assert repetido["estado"] == "confirmada"
    assert _conteos(db_session) == conteos
    assert db_session.query(ImportacionCobranza).count() == 1


def test_confirmacion_revalida_y_no_aplica_pagos_obsoletos(
    client_autenticado, db_session
):
    crear_catalogo_evento_pago_registrado(db_session)
    facturas, lote = _lote_con_facturas(client_autenticado, db_session, 1)
    texto = respuesta(client_autenticado, lote)
    revision = preview(client_autenticado, texto).json()

    factura = db_session.get(Factura, facturas[0].id)
    facturas_service.registrar_pago(
        db_session,
        factura=factura,
        usuario_registro_id=uuid.uuid4(),
        fecha=date.today(),
        monto=Decimal("100.00"),
        metodo_pago_id=METODO_DEMO,
        referencia_transaccion="MANUAL-100",
        comprobante_nombre=None,
        comprobante_tipo_contenido=None,
        comprobante_contenido=None,
    )
    assert db_session.query(Pago).count() == 1
    antes = _conteos(db_session)

    resultado = confirmar(client_autenticado, revision["id"])

    assert resultado.status_code == 200
    assert resultado.json()["estado"] == "en_revision"
    assert resultado.json()["puede_confirmar"] is False
    assert resultado.json()["resumen"]["errores"]["cantidad"] == 1
    assert db_session.query(Pago).count() == 1
    assert db_session.query(DebitoCobranza).one().resultado_hash is None
    assert _conteos(db_session) == antes


def test_revalidacion_bloquea_todo_si_una_fila_cambio(client_autenticado, db_session):
    crear_catalogo_evento_pago_registrado(db_session)
    facturas, lote = _lote_con_facturas(client_autenticado, db_session, 2)
    texto = respuesta(client_autenticado, lote)
    revision = preview(client_autenticado, texto).json()
    db_session.get(Factura, facturas[0].id).estado = "pagada"
    db_session.commit()

    resultado = confirmar(client_autenticado, revision["id"])

    assert resultado.status_code == 200
    assert resultado.json()["estado"] == "en_revision"
    assert resultado.json()["resumen"]["errores"]["cantidad"] == 1
    assert db_session.query(Pago).count() == 0
    assert {debito.resultado_hash for debito in db_session.scalars(select(DebitoCobranza))} == {
        None
    }
    assert db_session.get(Factura, facturas[1].id).estado == "pendiente"


def test_rechazo_valido_libera_reserva_y_permite_nuevo_lote(client_autenticado, db_session):
    crear_catalogo_evento_pago_registrado(db_session)
    facturas, lote = _lote_con_facturas(client_autenticado, db_session, 1)
    texto = respuesta(client_autenticado, lote, rechazos_cantidad=1)
    revision = preview(client_autenticado, texto).json()
    assert revision["puede_confirmar"] is True
    assert revision["resumen"]["rechazados"] == {"cantidad": 1, "importe": "100.00"}

    confirmado = confirmar(client_autenticado, revision["id"]).json()
    assert confirmado["estado"] == "confirmada"
    assert db_session.query(Pago).count() == 0
    assert db_session.query(DebitoCobranza).one().reserva_activa is False
    assert db_session.get(Factura, facturas[0].id).estado == "pendiente"

    elegibles = client_autenticado.get(BASE + "/facturas-elegibles")
    assert str(facturas[0].id) in {item["id"] for item in elegibles.json()["items"]}
    nuevo = exportar(client_autenticado, [facturas[0].id])
    assert nuevo.status_code == 201, nuevo.text
    assert nuevo.json()["codigo"] != lote["codigo"]


def test_lote_liberado_bloquea_su_respuesta_obsoleta(client_autenticado, db_session):
    facturas, lote = _lote_con_facturas(client_autenticado, db_session, 1)
    texto = respuesta(client_autenticado, lote)
    liberado = client_autenticado.post(
        f"{BASE}/{lote['id']}/liberar",
        json={"motivo": "El banco no procesó el lote", "confirmacion_no_procesado": True},
    )
    assert liberado.status_code == 200

    resultado = preview(client_autenticado, texto)

    assert resultado.status_code == 200
    cuerpo = resultado.json()
    assert cuerpo["id"] is None
    assert cuerpo["lote_id"] == lote["id"]
    assert cuerpo["errores"]
    assert "liberado" in cuerpo["errores"][0]
    assert cuerpo["puede_confirmar"] is False
    assert db_session.query(ImportacionCobranza).count() == 0
    assert db_session.query(Pago).count() == 0
    assert db_session.get(Factura, facturas[0].id).estado == "pendiente"


def test_detalle_paginado_y_filtros_no_alteran_el_resumen(client_autenticado, db_session):
    _, lote = _lote_con_facturas(client_autenticado, db_session, 8)
    texto = respuesta(client_autenticado, lote, rechazos_cantidad=1)
    revision = preview(client_autenticado, texto).json()

    por_defecto = client_autenticado.get(f"{BASE}/importaciones/{revision['id']}").json()
    assert por_defecto["total"] == 1
    assert por_defecto["items"][0]["resultado"] == formato.RECHAZADO
    assert por_defecto["resumen"] == revision["resumen"]

    cobrados = client_autenticado.get(
        f"{BASE}/importaciones/{revision['id']}",
        params={"resultado": "cobrados", "pagina": 2, "tamanio": 3},
    ).json()
    assert cobrados["total"] == 7
    assert cobrados["pagina"] == 2
    assert len(cobrados["items"]) == 3
    assert cobrados["resumen"] == revision["resumen"]

    errores = client_autenticado.get(
        f"{BASE}/importaciones/{revision['id']}", params={"resultado": "errores"}
    ).json()
    assert errores["total"] == 0
    rechazados = client_autenticado.get(
        f"{BASE}/importaciones/{revision['id']}", params={"resultado": "rechazados"}
    ).json()
    assert rechazados["total"] == 1
    todos = client_autenticado.get(
        f"{BASE}/importaciones/{revision['id']}", params={"resultado": "todos"}
    ).json()
    assert todos["total"] == 8


def test_incidencias_descarga_rechazados_y_errores_completos(client_autenticado, db_session):
    _, lote = _lote_con_facturas(client_autenticado, db_session, 3)
    base = respuesta(client_autenticado, lote, rechazos_cantidad=1)
    lote_id, filas = formato.leer_respuesta(base)
    pendiente = next(fila for fila in filas if fila.resultado == formato.COBRADO)
    fila_invalida = formato.RespuestaDetalle(
        pendiente.referencia,
        pendiente.resultado,
        Decimal("99.00"),
        pendiente.fecha,
        "",
        "",
    )
    sin_pendiente = [fila for fila in filas if fila.referencia != pendiente.referencia]
    texto = formato.generar_respuesta(lote_id, date.today(), sin_pendiente + [fila_invalida])
    revision = preview(client_autenticado, texto).json()
    assert revision["puede_confirmar"] is False

    incidencias = client_autenticado.get(
        f"{BASE}/importaciones/{revision['id']}/incidencias"
    )

    assert incidencias.status_code == 200
    archivo = incidencias.json()
    assert archivo["nombre"].startswith("ESSERI_SIMULADO")
    lineas = archivo["contenido"].strip().splitlines()
    assert lineas[0].startswith("linea;")
    assert len(lineas) == 3
    assert any(formato.RECHAZADO in linea for linea in lineas[1:])
    assert any("error" in linea for linea in lineas[1:])


def test_confirmar_otra_revision_tras_confirmar_el_lote(client_autenticado, db_session):
    crear_catalogo_evento_pago_registrado(db_session)
    _, lote = _lote_con_facturas(client_autenticado, db_session, 1)
    primera = preview(client_autenticado, respuesta(client_autenticado, lote)).json()
    segunda = preview(
        client_autenticado, respuesta(client_autenticado, lote, rechazos_cantidad=1)
    ).json()
    assert primera["id"] != segunda["id"]
    assert confirmar(client_autenticado, primera["id"]).json()["estado"] == "confirmada"
    conteos = _conteos(db_session)

    resultado = confirmar(client_autenticado, segunda["id"])

    assert resultado.status_code == 200
    assert resultado.json()["estado"] == "en_revision"
    assert resultado.json()["errores"]
    assert resultado.json()["puede_confirmar"] is False
    assert _conteos(db_session) == conteos
    assert db_session.query(Pago).count() == 1


def test_envelope_malformado_devuelve_campos_nulos_sin_persistir(
    client_autenticado, db_session
):
    resultado = preview(client_autenticado, "esto no es un archivo")

    assert resultado.status_code == 200
    cuerpo = resultado.json()
    assert cuerpo["id"] is None
    assert cuerpo["lote_id"] is None
    assert cuerpo["estado"] is None
    assert cuerpo["archivo_hash"] is None
    assert cuerpo["errores"]
    assert cuerpo["puede_confirmar"] is False
    assert cuerpo["resumen"] == {
        "procesados": {"cantidad": 0, "importe": "0.00"},
        "cobrados": {"cantidad": 0, "importe": "0.00"},
        "rechazados": {"cantidad": 0, "importe": "0.00"},
        "errores": {"cantidad": 0, "importe": "0.00"},
    }
    assert cuerpo["items"] == []
    assert db_session.query(ImportacionCobranza).count() == 0


def test_confirmar_importacion_inexistente_es_404(client_autenticado):
    respuesta_http = confirmar(client_autenticado, uuid.uuid4())
    assert respuesta_http.status_code == 404


def test_permisos(client_solo_lectura):
    assert client_solo_lectura.get(BASE + "/opciones").status_code == 403
    assert client_solo_lectura.get(BASE + "/facturas-elegibles").status_code == 403
    assert client_solo_lectura.get(BASE + "/liberaciones").status_code == 403
    assert client_solo_lectura.post(BASE + "/resumen-seleccion", json={}).status_code == 403
