from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import select

from src.auth.models import Usuario
from src.facturacion.cuenta_corriente_service import listar_deuda_por_familia, total_deuda
from src.facturacion.models import (
    CuentaCorriente,
    Factura,
    MetodoPago,
    Movimiento,
    Pago,
    ResponsableEconomico,
)
from src.inscripciones.models import Asistencia
from src.panel_admin.service import obtener_evolucion_financiera, obtener_indicadores_direccion
from src.proveedores_compras.models import SolicitudCompra
from src.workflows.models import Tarea
from tests.inscripciones.factories import crear_escenario, crear_inscripcion_previa

OPERATIVO = datetime(2026, 9, 1, tzinfo=UTC)


def _crear_cuenta(db_session, alumno_id):
    cuenta = CuentaCorriente(alumno_id=alumno_id)
    db_session.add(cuenta)
    db_session.flush()
    return cuenta


def _cargo(db_session, cuenta, factura, monto):
    db_session.add(
        Movimiento(
            fecha=OPERATIVO,
            tipo="debe",
            monto=monto,
            cuenta_corriente_id=cuenta.id,
            factura_id=factura.id,
        )
    )


def _pago(db_session, cuenta, factura, monto, *, estado="aprobado", fecha=OPERATIVO):
    pago = Pago(
        fecha=fecha.date() if isinstance(fecha, datetime) else fecha,
        monto=monto,
        estado=estado,
        factura_id=factura.id,
        metodo_pago_id=db_session.scalar(select(MetodoPago.id)),
    )
    db_session.add(pago)
    db_session.flush()
    if estado == "aprobado":
        db_session.add(
            Movimiento(
                fecha=fecha,
                tipo="haber",
                monto=monto,
                cuenta_corriente_id=cuenta.id,
                factura_id=factura.id,
                pago_id=pago.id,
            )
        )
    return pago


def _escenario_facturacion(db_session, *, ciclo="2027", estado_inscripcion="activa"):
    escenario = crear_escenario(db_session)
    inscripcion = crear_inscripcion_previa(
        db_session, escenario, ciclo=ciclo, estado=estado_inscripcion
    )
    responsable = ResponsableEconomico(
        vigencia_desde=date(2026, 1, 1),
        alumno_id=escenario["alumno_id"],
        familia_id=escenario["familia_id"],
    )
    metodo_pago = MetodoPago(
        nombre=f"Transferencia {ciclo}", activo=True, requiere_comprobante=False
    )
    db_session.add_all([responsable, metodo_pago])
    db_session.flush()
    return escenario, inscripcion, responsable


def _factura(db_session, inscripcion, responsable, *, monto, vencimiento, estado):
    factura = Factura(
        fecha_emision=date(2026, 8, 1),
        fecha_vencimiento=vencimiento,
        monto_total=monto,
        estado=estado,
        inscripcion_id=inscripcion.id,
        responsable_economico_id=responsable.id,
    )
    db_session.add(factura)
    db_session.flush()
    return factura


def test_la_deuda_sale_del_libro_y_no_de_factura_menos_pagos(db_session):
    escenario, inscripcion, responsable = _escenario_facturacion(db_session)
    cuenta = _crear_cuenta(db_session, escenario["alumno_id"])
    factura = _factura(
        db_session,
        inscripcion,
        responsable,
        monto=Decimal("100.00"),
        vencimiento=date(2026, 8, 10),
        estado="pagada",
    )
    _cargo(db_session, cuenta, factura, Decimal("100.00"))
    # Penalidad imputada al mismo comprobante: no existe como Factura y el libro sí la cuenta.
    _cargo(db_session, cuenta, factura, Decimal("10.00"))
    _pago(db_session, cuenta, factura, Decimal("40.00"))
    db_session.commit()

    indicadores = obtener_indicadores_direccion(db_session, fecha_hoy=date(2026, 9, 20))

    assert indicadores["deuda_pendiente_total"] == Decimal("70.00")
    assert indicadores["deuda_vencida_total"] == Decimal("70.00")
    assert indicadores["familias_en_mora"] == 1


def test_el_total_coincide_con_la_lista_canonica_por_familia(db_session):
    escenario, inscripcion, responsable = _escenario_facturacion(db_session)
    cuenta = _crear_cuenta(db_session, escenario["alumno_id"])
    vencida = _factura(
        db_session,
        inscripcion,
        responsable,
        monto=Decimal("100.00"),
        vencimiento=date(2026, 8, 10),
        estado="pendiente",
    )
    futura = _factura(
        db_session,
        inscripcion,
        responsable,
        monto=Decimal("70.00"),
        vencimiento=date(2026, 9, 20),
        estado="pendiente",
    )
    _cargo(db_session, cuenta, vencida, Decimal("100.00"))
    _cargo(db_session, cuenta, futura, Decimal("70.00"))
    _pago(db_session, cuenta, vencida, Decimal("30.00"))
    db_session.commit()

    totales = total_deuda(db_session, fecha_referencia=date(2026, 9, 5))
    filas, _ = listar_deuda_por_familia(
        db_session, fecha_referencia=date(2026, 9, 5), pagina=1, tamanio=10
    )

    assert totales["vencida"] == Decimal("70.00")
    assert totales["no_vencida"] == Decimal("70.00")
    assert sum(Decimal(str(fila["deuda_total"])) for fila in filas) == Decimal("140.00")
    assert totales["vencida"] + totales["no_vencida"] == Decimal("140.00")


def test_facturas_vencidas_ignora_la_columna_estado_y_mira_el_saldo(db_session):
    escenario, inscripcion, responsable = _escenario_facturacion(db_session)
    cuenta = _crear_cuenta(db_session, escenario["alumno_id"])
    saldada = _factura(
        db_session,
        inscripcion,
        responsable,
        monto=Decimal("100.00"),
        vencimiento=date(2026, 8, 10),
        estado="vencida",
    )
    impaga = _factura(
        db_session,
        inscripcion,
        responsable,
        monto=Decimal("50.00"),
        vencimiento=date(2026, 8, 12),
        estado="pendiente",
    )
    futura = _factura(
        db_session,
        inscripcion,
        responsable,
        monto=Decimal("80.00"),
        vencimiento=date(2026, 9, 30),
        estado="pendiente",
    )
    for factura in (saldada, impaga, futura):
        _cargo(db_session, cuenta, factura, factura.monto_total)
    _pago(db_session, cuenta, saldada, Decimal("100.00"))
    db_session.commit()

    totales = total_deuda(db_session, fecha_referencia=date(2026, 9, 5))

    assert totales["facturas_vencidas"] == 1
    assert totales["vencida"] == Decimal("50.00")
    assert totales["no_vencida"] == Decimal("80.00")


def test_indicadores_separan_deuda_vencida_y_cuentan_altas_y_bajas_del_mes(db_session):
    escenario, inscripcion, responsable = _escenario_facturacion(
        db_session, ciclo="2026", estado_inscripcion="activa"
    )
    inscripcion.fecha_inscripcion = date(2026, 9, 1)
    cuenta = _crear_cuenta(db_session, escenario["alumno_id"])
    vencida_parcial = _factura(
        db_session,
        inscripcion,
        responsable,
        monto=Decimal("100.00"),
        vencimiento=date(2026, 8, 10),
        estado="vencida",
    )
    vencida_saldada = _factura(
        db_session,
        inscripcion,
        responsable,
        monto=Decimal("50.00"),
        vencimiento=date(2026, 8, 12),
        estado="pagada",
    )
    a_vencer = _factura(
        db_session,
        inscripcion,
        responsable,
        monto=Decimal("70.00"),
        vencimiento=date(2026, 9, 20),
        estado="pendiente",
    )
    for factura in (vencida_parcial, vencida_saldada, a_vencer):
        _cargo(db_session, cuenta, factura, factura.monto_total)
    _pago(db_session, cuenta, vencida_parcial, Decimal("30.00"))
    _pago(db_session, cuenta, vencida_saldada, Decimal("50.00"))
    db_session.commit()

    indicadores = obtener_indicadores_direccion(db_session, fecha_hoy=date(2026, 9, 5))

    assert indicadores["deuda_vencida_total"] == Decimal("70.00")
    assert indicadores["deuda_pendiente_total"] == Decimal("140.00")
    assert indicadores["familias_en_mora"] == 1
    assert indicadores["altas_mes"] == 1
    assert indicadores["bajas_mes"] == 0
    assert indicadores["asistencias_registradas_hoy"] == 0
    assert indicadores["solicitud_pendiente_mas_antigua"] is None


def test_el_ciclo_filtra_deuda_y_no_toca_alumnos_activos(db_session):
    escenario, inscripcion_2026, responsable = _escenario_facturacion(
        db_session, ciclo="2026", estado_inscripcion="activa"
    )
    inscripcion_2027 = crear_inscripcion_previa(
        db_session, escenario, ciclo="2027", estado="activa"
    )
    cuenta = _crear_cuenta(db_session, escenario["alumno_id"])
    for inscripcion, monto in (
        (inscripcion_2026, Decimal("100.00")),
        (inscripcion_2027, Decimal("50.00")),
    ):
        factura = _factura(
            db_session,
            inscripcion,
            responsable,
            monto=monto,
            vencimiento=date(2026, 8, 10),
            estado="pendiente",
        )
        _cargo(db_session, cuenta, factura, monto)
    db_session.commit()

    solo_2026 = obtener_indicadores_direccion(
        db_session, fecha_hoy=date(2026, 9, 20), ciclo_lectivo="2026"
    )
    todos = obtener_indicadores_direccion(db_session, fecha_hoy=date(2026, 9, 20))

    assert solo_2026["deuda_vencida_total"] == Decimal("100.00")
    assert todos["deuda_vencida_total"] == Decimal("150.00")
    assert solo_2026["alumnos_activos"] == todos["alumnos_activos"] == 1


def test_los_indicadores_usan_la_fecha_operativa_argentina(db_session, monkeypatch):
    escenario = crear_escenario(db_session)
    inscripcion = crear_inscripcion_previa(db_session, escenario, estado="activa")
    db_session.add(
        Asistencia(
            fecha=date(2026, 9, 1), tipo="ausente_injustificado", inscripcion_id=inscripcion.id
        )
    )
    db_session.commit()
    monkeypatch.setattr(
        "src.panel_admin.service.fecha_operativa_argentina", lambda: date(2026, 9, 1)
    )

    indicadores = obtener_indicadores_direccion(db_session)

    assert indicadores["inasistencias_hoy"] == 1


def test_cuentan_tareas_pendientes_y_escaladas(db_session):
    usuario = Usuario(
        email="tareas-panel@esseri.edu.ar",
        password_hash="x",
        auth_provider="local",
        estado="activo",
    )
    db_session.add(usuario)
    db_session.flush()
    db_session.add_all(
        [
            Tarea(titulo=estado, estado=estado, prioridad="media", usuario_id=usuario.id)
            for estado in ("pendiente", "en_progreso", "completada", "escalada")
        ]
    )
    db_session.add(
        SolicitudCompra(
            articulo="Resmas",
            cantidad=2,
            estado="pendiente",
            fecha=date(2026, 9, 1),
            usuario_id=usuario.id,
        )
    )
    db_session.commit()

    indicadores = obtener_indicadores_direccion(db_session, fecha_hoy=date(2026, 9, 1))

    assert indicadores["tareas_pendientes"] == 1
    assert indicadores["tareas_escaladas"] == 1


def test_evolucion_financiera_con_rango_cruza_de_anio(db_session):
    evolucion = obtener_evolucion_financiera(
        db_session, fecha_hoy=date(2026, 9, 1), desde=date(2025, 11, 10), hasta=date(2026, 2, 1)
    )

    assert [mes["mes"] for mes in evolucion] == ["2025-11", "2025-12", "2026-01", "2026-02"]


def test_solo_compras_no_puede_leer_evolucion_financiera(client_solo_compras):
    respuesta = client_solo_compras.get("/panel-admin/evolucion-financiera")

    assert respuesta.status_code == 403


def test_endpoint_de_indicadores_expone_los_campos_de_contexto(client_direccion):
    respuesta = client_direccion.get("/panel-admin/indicadores-direccion")

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    for campo in (
        "deuda_vencida_total",
        "familias_en_mora",
        "altas_mes",
        "bajas_mes",
        "asistencias_registradas_hoy",
        "solicitud_pendiente_mas_antigua",
        "tareas_pendientes",
        "tareas_escaladas",
    ):
        assert campo in cuerpo
    assert cuerpo["solicitud_pendiente_mas_antigua"] is None
