"""Eventos de negocio del módulo: emitir una orden y registrar una recepción dejan su hecho en
EVENT_LOG vía `emit_event()` (src/workflows/eventos_service.py), para que lo consuma el motor de
Workflows. Mismo criterio que tests/proveedores_compras/test_auditoria.py con `log_audit()`."""

import logging
import uuid
from datetime import date

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.auth.models import Usuario
from src.models import EventLog
from src.proveedores_compras.exceptions import RecepcionExcedeLoPedido, SolicitudNoAprobada
from src.proveedores_compras.models import OrdenCompra
from src.proveedores_compras.schemas import (
    OrdenCompraCreate,
    OrdenCompraDetalleCreate,
    ProductoServicioCreate,
    ProveedorCreate,
    RecepcionCompraCreate,
    RecepcionCompraDetalleCreate,
    SolicitudCompraCreate,
)
from src.proveedores_compras.service import (
    cambiar_estado_solicitud,
    cancelar_orden_compra,
    crear_orden_compra,
    crear_producto_servicio,
    crear_proveedor,
    crear_recepcion,
    crear_solicitud,
    obtener_detalles_de_orden,
)
from src.workflows import despacho_service
from src.workflows.despacho_service import procesar_eventos_pendientes
from src.workflows.models import TipoEvento, WorkflowExecution, WorkflowRule
from src.workflows.schemas import ResultadoAccion


def _crear_usuario(db_session, email="compras-eventos@esseri.edu.ar"):
    usuario = Usuario(
        email=email, password_hash="hash-de-prueba", auth_provider="local", estado="activo"
    )
    db_session.add(usuario)
    db_session.flush()
    return usuario


def _orden_de_10(db: Session, usuario_id: uuid.UUID | None = None) -> OrdenCompra:
    """Una orden emitida a "Papelera del Sur" con una sola línea de 10 unidades."""
    proveedor = crear_proveedor(db, ProveedorCreate(nombre="Papelera del Sur"))
    producto = crear_producto_servicio(
        db, ProductoServicioCreate(nombre="Resma A4", tipo="producto")
    )
    solicitud = crear_solicitud(
        db, SolicitudCompraCreate(articulo="Resmas A4", cantidad=10), uuid.uuid4()
    )
    cambiar_estado_solicitud(db, solicitud, "aprobada")
    return crear_orden_compra(
        db,
        OrdenCompraCreate(
            proveedor_id=proveedor.id,
            solicitud_ids=[solicitud.id],
            detalles=[
                OrdenCompraDetalleCreate(producto_servicio_id=producto.id, cantidad_pedida=10)
            ],
        ),
        usuario_id,
    )


def _recibir(db: Session, orden: OrdenCompra, cantidad: int, usuario_id: uuid.UUID):
    linea = obtener_detalles_de_orden(db, orden.id)[0]
    return crear_recepcion(
        db,
        orden,
        RecepcionCompraCreate(
            detalles=[
                RecepcionCompraDetalleCreate(
                    orden_compra_detalle_id=linea.id, cantidad_recibida=cantidad
                )
            ]
        ),
        usuario_id,
    )


def _eventos(db_session, tipo: str) -> list[EventLog]:
    return list(
        db_session.scalars(
            select(EventLog)
            .join(TipoEvento, TipoEvento.id == EventLog.tipo_evento_id)
            .where(TipoEvento.nombre == tipo)
        )
    )


class TestEventoOrdenEmitida:
    def test_emitir_orden_registra_el_evento_pendiente(self, db_session: Session):
        usuario = _crear_usuario(db_session)

        orden = _orden_de_10(db_session, usuario.id)

        eventos = _eventos(db_session, "orden_compra.emitida")
        assert len(eventos) == 1
        assert eventos[0].estado == "pendiente"
        assert eventos[0].entidad == "orden_compra"
        assert eventos[0].entidad_id == orden.id
        assert eventos[0].actor_tipo == "usuario"
        assert eventos[0].usuario_id == usuario.id
        assert eventos[0].payload == {
            "proveedor_nombre": "Papelera del Sur",
            "cantidad_items": 1,
            "fecha": date.today().isoformat(),
        }

    def test_sin_usuario_el_evento_es_del_sistema(self, db_session: Session):
        _orden_de_10(db_session)

        evento = _eventos(db_session, "orden_compra.emitida")[0]
        assert evento.actor_tipo == "sistema"
        assert evento.usuario_id is None

    def test_el_evento_se_confirma_en_la_misma_transaccion_que_la_orden(self, db_session: Session):
        """Si `emit_event()` quedara después del `commit`, este rollback se llevaría el evento."""
        _orden_de_10(db_session)

        db_session.rollback()

        assert len(_eventos(db_session, "orden_compra.emitida")) == 1

    def test_una_orden_rechazada_no_emite_evento(self, db_session: Session):
        proveedor = crear_proveedor(db_session, ProveedorCreate(nombre="Papelera del Sur"))
        producto = crear_producto_servicio(
            db_session, ProductoServicioCreate(nombre="Resma A4", tipo="producto")
        )

        with pytest.raises(SolicitudNoAprobada):
            crear_orden_compra(
                db_session,
                OrdenCompraCreate(
                    proveedor_id=proveedor.id,
                    solicitud_ids=[uuid.uuid4()],
                    detalles=[
                        OrdenCompraDetalleCreate(
                            producto_servicio_id=producto.id, cantidad_pedida=10
                        )
                    ],
                ),
            )

        assert _eventos(db_session, "orden_compra.emitida") == []

    def test_cancelar_la_orden_no_emite_otro_evento(self, db_session: Session):
        orden = _orden_de_10(db_session)

        cancelar_orden_compra(db_session, orden)

        assert len(db_session.scalars(select(EventLog)).all()) == 1


class TestEventoRecepcionRegistrada:
    def test_recepcion_parcial_registra_el_evento_con_tipo_parcial(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        orden = _orden_de_10(db_session, usuario.id)

        recepcion = _recibir(db_session, orden, 4, usuario.id)

        eventos = _eventos(db_session, "recepcion_compra.registrada")
        assert len(eventos) == 1
        assert eventos[0].estado == "pendiente"
        assert eventos[0].entidad == "recepcion_compra"
        assert eventos[0].entidad_id == recepcion.id
        assert eventos[0].actor_tipo == "usuario"
        assert eventos[0].usuario_id == usuario.id
        assert eventos[0].payload == {
            "proveedor_nombre": "Papelera del Sur",
            "tipo_recepcion": "parcial",
            "fecha": date.today().isoformat(),
        }

    def test_recepcion_total_registra_el_evento_con_tipo_total(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        orden = _orden_de_10(db_session, usuario.id)

        _recibir(db_session, orden, 10, usuario.id)

        evento = _eventos(db_session, "recepcion_compra.registrada")[0]
        assert evento.payload["tipo_recepcion"] == "total"

    def test_cada_recepcion_emite_su_propio_evento(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        orden = _orden_de_10(db_session, usuario.id)

        primera = _recibir(db_session, orden, 4, usuario.id)
        segunda = _recibir(db_session, orden, 6, usuario.id)

        eventos = _eventos(db_session, "recepcion_compra.registrada")
        assert {evento.entidad_id for evento in eventos} == {primera.id, segunda.id}
        assert sorted(evento.payload["tipo_recepcion"] for evento in eventos) == [
            "parcial",
            "total",
        ]

    def test_una_recepcion_rechazada_no_emite_evento(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        orden = _orden_de_10(db_session, usuario.id)

        with pytest.raises(RecepcionExcedeLoPedido):
            _recibir(db_session, orden, 11, usuario.id)

        assert _eventos(db_session, "recepcion_compra.registrada") == []


@pytest.mark.parametrize(("cantidad_recibida", "ejecuciones"), [(4, ["exitoso"]), (10, [])])
def test_una_regla_de_faltante_se_dispara_solo_con_recepcion_parcial(
    db_session: Session, monkeypatch, cantidad_recibida, ejecuciones
):
    """El caso de uso del evento, contra el despachador real: una regla con la condición
    `tipo_recepcion == parcial` avisa del faltante y no molesta cuando llegó todo."""
    monkeypatch.setattr(
        despacho_service,
        "ACCIONES",
        {"alerta_interna": lambda db, regla, evento, ejecucion: ResultadoAccion()},
    )
    tipo = db_session.scalars(
        select(TipoEvento).where(TipoEvento.nombre == "recepcion_compra.registrada")
    ).one()
    db_session.add(
        WorkflowRule(
            nombre="Avisar faltante",
            condicion={"campo": "tipo_recepcion", "operador": "==", "valor": "parcial"},
            tipo_accion="alerta_interna",
            accion_config=None,
            criticidad="media",
            requiere_aprobacion_humana=False,
            activo=True,
            tipo_evento_id=tipo.id,
        )
    )
    usuario = _crear_usuario(db_session)
    orden = _orden_de_10(db_session, usuario.id)
    _recibir(db_session, orden, cantidad_recibida, usuario.id)

    resumen = procesar_eventos_pendientes(db_session)

    # Dos eventos: la orden emitida (sin reglas) y la recepción.
    assert resumen.eventos_procesados == 2
    assert {evento.estado for evento in db_session.scalars(select(EventLog))} == {"procesado"}
    assert [
        ejecucion.estado for ejecucion in db_session.scalars(select(WorkflowExecution))
    ] == ejecuciones


def test_los_payloads_traen_los_campos_que_declara_el_catalogo(db_session: Session, caplog):
    """`emit_event()` no rechaza un payload incompleto o mal tipado: solo loggea un warning. Sin
    este test, un campo renombrado en el seed pasaría inadvertido."""
    usuario = _crear_usuario(db_session)

    with caplog.at_level(logging.WARNING, logger="src.workflows.eventos_service"):
        orden = _orden_de_10(db_session, usuario.id)
        _recibir(db_session, orden, 4, usuario.id)

    assert caplog.text == ""
