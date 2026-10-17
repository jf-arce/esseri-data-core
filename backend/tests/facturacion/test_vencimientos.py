"""Detección de facturas vencidas y emisión de `factura.vencida`."""

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import select

from src.auth import sesion_service
from src.auth.constants import ACCION_LEER, MODULO_FACTURACION
from src.auth.models import Permiso, Rol, RolPermiso, Usuario, UsuarioRol
from src.facturacion import facturacion_job
from src.facturacion.facturas_service import crear_factura, registrar_pago
from src.facturacion.models import (
    ConceptoCobro,
    ExcepcionVencimiento,
    MetodoPago,
    ResponsableEconomico,
)
from src.facturacion.schemas import DetalleFacturaCreate, FacturaCreate
from src.facturacion.vencimientos_service import detectar_facturas_vencidas
from src.models import EventLog
from tests.facturacion.conftest import PASSWORD_VALIDA
from tests.inscripciones.factories import crear_escenario, crear_inscripcion_previa

VENCIMIENTO = date(2027, 3, 5)


@pytest.fixture()
def escenario(db_session, tipo_factura_vencida):
    datos = crear_escenario(db_session)
    inscripcion = crear_inscripcion_previa(db_session, datos, estado="activa")
    concepto = ConceptoCobro(nombre="Cuota", activo=True)
    metodo = MetodoPago(nombre="Efectivo", activo=True, requiere_comprobante=False)
    usuario = Usuario(
        email="cobranzas@esseri.edu.ar",
        password_hash="hash-de-prueba",
        auth_provider="local",
        estado="activo",
    )
    db_session.add_all(
        [
            concepto,
            metodo,
            usuario,
            ResponsableEconomico(
                vigencia_desde=date(2027, 1, 1),
                alumno_id=datos["alumno_id"],
                familia_id=datos["familia_id"],
            ),
        ]
    )
    db_session.commit()
    factura = crear_factura(
        db_session,
        FacturaCreate(
            fecha_emision=date(2027, 3, 1),
            fecha_vencimiento=VENCIMIENTO,
            inscripcion_id=inscripcion.id,
            detalles=[
                DetalleFacturaCreate(
                    descripcion="Cuota", monto=Decimal("100.00"), concepto_cobro_id=concepto.id
                )
            ],
        ),
    )
    return {
        "factura": factura,
        "familia_id": datos["familia_id"],
        "metodo": metodo,
        "usuario": usuario,
    }


def _eventos(db_session):
    return list(db_session.scalars(select(EventLog).order_by(EventLog.timestamp)).all())


def _pagar(db_session, escenario, monto):
    registrar_pago(
        db_session,
        factura=escenario["factura"],
        usuario_registro_id=escenario["usuario"].id,
        fecha=date(2027, 3, 4),
        monto=Decimal(monto),
        metodo_pago_id=escenario["metodo"].id,
        referencia_transaccion=None,
        comprobante_nombre=None,
        comprobante_tipo_contenido=None,
        comprobante_contenido=None,
    )


def test_factura_que_todavia_no_vencio_no_emite(db_session, escenario):
    resumen = detectar_facturas_vencidas(db_session, VENCIMIENTO)

    assert resumen.eventos_emitidos == 0
    assert _eventos(db_session) == []


def test_dia_uno_emite_con_tramo_cero(db_session, escenario):
    resumen = detectar_facturas_vencidas(db_session, date(2027, 3, 6))

    assert resumen.facturas_revisadas == 1
    assert resumen.eventos_emitidos == 1
    (evento,) = _eventos(db_session)
    assert evento.entidad_id == escenario["factura"].id
    assert evento.payload["dias_vencido"] == 1
    assert evento.payload["tramo_desde_dia"] == 0


def test_correr_dos_veces_el_mismo_dia_emite_una_sola_vez(db_session, escenario):
    detectar_facturas_vencidas(db_session, date(2027, 3, 6))
    resumen = detectar_facturas_vencidas(db_session, date(2027, 3, 6))

    assert resumen.eventos_emitidos == 0
    assert len(_eventos(db_session)) == 1


def test_emite_un_evento_por_tramo(db_session, escenario):
    for dia in (6, 11, 21):
        detectar_facturas_vencidas(db_session, date(2027, 3, dia))

    tramos = [evento.payload["tramo_desde_dia"] for evento in _eventos(db_session)]
    assert tramos == [0, 6, 16]


def test_si_se_salta_un_tramo_emite_solo_el_actual(db_session, escenario):
    detectar_facturas_vencidas(db_session, date(2027, 3, 6))
    detectar_facturas_vencidas(db_session, date(2027, 3, 25))

    tramos = [evento.payload["tramo_desde_dia"] for evento in _eventos(db_session)]
    assert tramos == [0, 16]


def test_factura_pagada_no_emite(db_session, escenario):
    escenario["factura"].estado = "pagada"
    db_session.commit()

    assert detectar_facturas_vencidas(db_session, date(2027, 3, 20)).eventos_emitidos == 0


def test_deuda_cero_por_pagos_aprobados_no_emite(db_session, escenario):
    _pagar(db_session, escenario, "100.00")

    assert detectar_facturas_vencidas(db_session, date(2027, 3, 20)).eventos_emitidos == 0


def _excepcion(db_session, escenario, fecha):
    db_session.add(
        ExcepcionVencimiento(
            fecha_vencimiento_excepcional=fecha,
            familia_id=escenario["familia_id"],
            usuario_id=escenario["usuario"].id,
        )
    )
    db_session.commit()


def test_excepcion_del_mismo_mes_corre_la_fecha(db_session, escenario):
    _excepcion(db_session, escenario, date(2027, 3, 10))

    assert detectar_facturas_vencidas(db_session, date(2027, 3, 8)).eventos_emitidos == 0
    detectar_facturas_vencidas(db_session, date(2027, 3, 12))

    (evento,) = _eventos(db_session)
    assert evento.payload["dias_vencido"] == 2
    assert evento.payload["fecha_vencimiento_efectiva"] == "2027-03-10"


def test_excepcion_de_otro_mes_se_ignora(db_session, escenario):
    _excepcion(db_session, escenario, date(2027, 4, 10))

    detectar_facturas_vencidas(db_session, date(2027, 3, 12))

    (evento,) = _eventos(db_session)
    assert evento.payload["dias_vencido"] == 7


def test_payload_trae_deuda_pendiente_y_nombre_de_familia(db_session, escenario):
    _pagar(db_session, escenario, "40.00")

    detectar_facturas_vencidas(db_session, date(2027, 3, 6))

    (evento,) = _eventos(db_session)
    assert Decimal(str(evento.payload["monto_deuda"])) == Decimal("60.00")
    assert evento.payload["nombre_familia"] == "Cabral, Lorena"


def _client_con_permiso_de_lectura(client, db_session):
    usuario = Usuario(
        email="lector-facturacion@esseri.edu.ar",
        password_hash=sesion_service.hashear_password(PASSWORD_VALIDA),
        auth_provider="local",
        estado="activo",
    )
    rol = Rol(nombre="lector de facturacion")
    permiso = Permiso(modulo=MODULO_FACTURACION, accion=ACCION_LEER)
    db_session.add_all([usuario, rol, permiso])
    db_session.flush()
    db_session.add_all(
        [
            RolPermiso(rol_id=rol.id, permiso_id=permiso.id),
            UsuarioRol(usuario_id=usuario.id, rol_id=rol.id),
        ]
    )
    db_session.commit()
    respuesta = client.post(
        "/auth/login", json={"email": usuario.email, "password": PASSWORD_VALIDA}
    )
    assert respuesta.status_code == 200
    return client


def test_endpoint_procesa_con_permiso_y_respeta_fecha_referencia(
    client_autenticado, db_session, escenario
):
    url = "/facturacion/vencimientos/procesar"

    antes = client_autenticado.post(url, params={"fecha_referencia": "2027-03-05"})
    despues = client_autenticado.post(url, params={"fecha_referencia": "2027-03-06"})

    assert antes.status_code == 200
    assert antes.json() == {"facturas_revisadas": 0, "eventos_emitidos": 0}
    assert despues.json() == {"facturas_revisadas": 1, "eventos_emitidos": 1}


def test_endpoint_sin_permiso_de_actualizar_es_403(client, db_session):
    lector = _client_con_permiso_de_lectura(client, db_session)

    assert lector.post("/facturacion/vencimientos/procesar").status_code == 403


def test_job_detecta_vencimientos_aunque_falle_la_facturacion(monkeypatch):
    llamadas: list[str] = []

    def fallar(*_args, **_kwargs):
        raise RuntimeError("falla la facturación")

    monkeypatch.setattr(facturacion_job, "ejecutar_facturacion_automatica", fallar)
    monkeypatch.setattr(
        facturacion_job, "detectar_facturas_vencidas", lambda _db: llamadas.append("detectar")
    )
    monkeypatch.setattr(facturacion_job, "SessionLocal", lambda: _SesionFalsa())

    facturacion_job._ejecutar_corrida_con_sesion()

    assert llamadas == ["detectar"]


class _SesionFalsa:
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False
