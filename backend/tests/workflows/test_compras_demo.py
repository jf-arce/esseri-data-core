"""Workflow de Compras (#210, #214): destinatario `solicitante` y reglas de demo, de la solicitud
aprobada a la recepción."""

import importlib.util
import uuid
from pathlib import Path

import pytest
from sqlalchemy import select

from src.auth.models import Rol, Usuario, UsuarioRol
from src.models import EventLog
from src.proveedores_compras.models import OrdenCompra, ProductoProveedor
from src.proveedores_compras.schemas import (
    ProductoServicioCreate,
    ProveedorCreate,
    RecepcionCompraCreate,
    RecepcionCompraDetalleCreate,
    SolicitudCompraCreate,
)
from src.proveedores_compras.service import (
    cambiar_estado_solicitud,
    crear_producto_servicio,
    crear_proveedor,
    crear_recepcion,
    crear_solicitud,
    obtener_detalles_de_orden,
)
from src.workflows.acciones_compras_service import ejecutar_generar_orden_compra
from src.workflows.despacho_service import procesar_eventos_pendientes
from src.workflows.ejecuciones_service import aprobar_ejecucion
from src.workflows.models import (
    NotificacionTemplate,
    ReglaDestinatario,
    TipoEvento,
    WorkflowExecution,
    WorkflowRule,
)
from src.workflows.notificaciones_service import (
    ERROR_SIN_SOLICITANTE,
    ERRORES_CONTROLADOS,
    _SinSolicitante,
    resolver_destinatarios,
)
from tests.proveedores_compras.conftest import catalogo_eventos_compras  # noqa: F401

SEED = Path(__file__).resolve().parents[3] / "database" / "seeds" / "04_seed_demo.py"


@pytest.fixture(scope="module")
def seed_demo():
    """El seed no es un paquete (su nombre empieza con un número): se carga por ruta."""
    spec = importlib.util.spec_from_file_location("seed_demo_compras", SEED)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


def _usuario(db, email, *, estado="activo", rol=None):
    usuario = Usuario(email=email, auth_provider="local", password_hash="x", estado=estado)
    db.add(usuario)
    db.flush()
    if rol is not None:
        db.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol.id))
    db.commit()
    return usuario


@pytest.fixture()
def solicitante(db_session):
    return _usuario(db_session, "pide@esseri.edu.ar")


@pytest.fixture()
def producto(db_session):
    producto = crear_producto_servicio(
        db_session, ProductoServicioCreate(nombre="Resma A4", tipo="producto")
    )
    proveedor = crear_proveedor(db_session, ProveedorCreate(nombre="Papelera del Sur"))
    db_session.add(ProductoProveedor(producto_servicio_id=producto.id, proveedor_id=proveedor.id))
    db_session.commit()
    return producto


def _aprobar(db, usuario, producto, cantidad=10):
    solicitud = crear_solicitud(
        db, SolicitudCompraCreate(producto_servicio_id=producto.id, cantidad=cantidad), usuario.id
    )
    cambiar_estado_solicitud(db, solicitud, "aprobada", usuario.id)
    return solicitud


def _tipo(db, nombre):
    return db.scalar(select(TipoEvento).where(TipoEvento.nombre == nombre))


def _regla_notificar(db, evento, plantilla=None):
    regla = WorkflowRule(
        nombre="Avisar al solicitante",
        condicion={},
        tipo_accion="notificar",
        accion_config={"destinatario": "solicitante"},
        criticidad="baja",
        requiere_aprobacion_humana=False,
        activo=True,
        tipo_evento_id=_tipo(db, evento).id,
        notificacion_template_id=None if plantilla is None else plantilla.id,
    )
    db.add(regla)
    db.commit()
    return regla


def _evento(db, entidad, entidad_id):
    return db.scalar(
        select(EventLog).where(EventLog.entidad == entidad, EventLog.entidad_id == entidad_id)
    )


def _emitir_orden(db, solicitud, producto):
    """Emite la orden con el ejecutor, como lo hace la regla de demo."""
    evento = _evento(db, "solicitud_compra", solicitud.id)
    ejecutar_generar_orden_compra(db, WorkflowRule(), evento, WorkflowExecution())
    db.commit()
    return db.scalars(select(OrdenCompra)).one()


def _recibir(db, orden, usuario, cantidad=10):
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
        usuario.id,
    )


# --- Destinatario `solicitante` ------------------------------------------------------------


def test_solicitante_se_resuelve_desde_solicitud_orden_y_recepcion(
    db_session, solicitante, producto
):
    otro = _usuario(db_session, "recibe@esseri.edu.ar")
    solicitud = _aprobar(db_session, solicitante, producto)
    orden = _emitir_orden(db_session, solicitud, producto)
    recepcion = _recibir(db_session, orden, otro)

    for entidad, entidad_id, nombre in (
        ("solicitud_compra", solicitud.id, "solicitud_compra.aprobada"),
        ("orden_compra", orden.id, "orden_compra.emitida"),
        ("recepcion_compra", recepcion.id, "recepcion_compra.registrada"),
    ):
        regla = _regla_notificar(db_session, nombre)
        destinatarios, sin_email = resolver_destinatarios(
            db_session, regla, _evento(db_session, entidad, entidad_id), "solicitante"
        )
        # El que pidió, no quien registró la recepción.
        assert [d.email for d in destinatarios] == ["pide@esseri.edu.ar"], entidad
        assert sin_email == 0


def test_solicitante_inactivo_no_recibe(db_session, solicitante, producto, envios):
    plantilla = NotificacionTemplate(nombre="Aviso", asunto="Compra de {{item}}", cuerpo="Ok")
    db_session.add(plantilla)
    db_session.commit()
    _regla_notificar(db_session, "solicitud_compra.aprobada", plantilla)
    _aprobar(db_session, solicitante, producto)
    solicitante.estado = "inactivo"
    db_session.commit()

    procesar_eventos_pendientes(db_session)

    ejecucion = db_session.scalars(select(WorkflowExecution)).one()
    assert ejecucion.estado == "fallido"
    assert envios.enviados == []


def test_evento_que_no_es_de_compras_da_error_claro(db_session, tipo_factura_vencida):
    regla = _regla_notificar(db_session, "solicitud_compra.aprobada")
    evento = EventLog(
        actor_tipo="sistema",
        entidad="factura",
        entidad_id=uuid.uuid4(),
        tipo_evento_id=tipo_factura_vencida.id,
    )

    with pytest.raises(_SinSolicitante):
        resolver_destinatarios(db_session, regla, evento, "solicitante")
    assert ERROR_SIN_SOLICITANTE in ERRORES_CONTROLADOS


def test_solicitante_solo_se_acepta_en_eventos_de_compras(
    client_autenticado, db_session, tipo_factura_vencida
):
    def crear(tipo_id):
        return client_autenticado.post(
            "/workflows/reglas",
            json={
                "nombre": "Aviso",
                "tipo_evento_id": str(tipo_id),
                "condicion": {},
                "tipo_accion": "notificar",
                "accion_config": {"destinatario": "solicitante"},
                "criticidad": "baja",
            },
        )

    rechazada = crear(tipo_factura_vencida.id)
    assert rechazada.status_code == 422
    assert "no tiene solicitante" in rechazada.json()["detail"]
    assert crear(_tipo(db_session, "recepcion_compra.registrada").id).status_code == 201


# --- Reglas de demo (#214) -----------------------------------------------------------------


@pytest.fixture()
def demo(db_session, seed_demo, monkeypatch):
    monkeypatch.setattr(seed_demo, "DEMO_EMAIL_BASE", "")
    db_session.add(Rol(nombre="compras"))
    usuario = _usuario(db_session, "demo@esseri.edu.ar")
    seed_demo._ensure_reglas_compras(db_session, usuario)
    db_session.commit()
    return usuario


def _regla(db, nombre):
    return db.scalars(select(WorkflowRule).where(WorkflowRule.nombre == nombre)).one()


def test_el_seed_crea_las_reglas_de_compras(db_session, demo, seed_demo):
    orden = _regla(db_session, "Compras 1: generar orden de compra")
    alerta = _regla(db_session, "Compras 2: alerta al área de Compras")
    aviso = _regla(db_session, "Compras 3: aviso al solicitante")

    assert orden.tipo_accion == "generar_orden_compra"
    assert orden.requiere_aprobacion_humana is True
    assert alerta.tipo_accion == "alerta_interna"
    rol_ids = db_session.scalars(
        select(ReglaDestinatario.rol_id).where(ReglaDestinatario.workflow_rule_id == alerta.id)
    ).all()
    assert [db_session.get(Rol, r).nombre for r in rol_ids] == ["compras"]
    assert aviso.accion_config["destinatario"] == "solicitante"
    assert aviso.notificacion_template_id is not None

    seed_demo._ensure_reglas_compras(db_session, demo)
    db_session.commit()
    assert len(db_session.scalars(select(WorkflowRule)).all()) == 3


def test_flujo_completo_de_la_demo(db_session, demo, solicitante, producto, envios):
    # La cuenta del área la crea el seed, con el rol compras.
    compras = db_session.scalar(select(Usuario).where(Usuario.email == "compras@esseri.local"))
    solicitud = _aprobar(db_session, solicitante, producto, cantidad=12)

    # 1. La solicitud aprobada deja la orden esperando aprobación humana.
    procesar_eventos_pendientes(db_session)
    pendiente = db_session.scalars(
        select(WorkflowExecution).where(WorkflowExecution.estado == "pendiente")
    ).one()
    assert db_session.scalars(select(OrdenCompra)).all() == []

    # 2. Al aprobarla se emite la orden, y la orden emitida alerta al área de Compras.
    aprobar_ejecucion(db_session, pendiente.id, compras.id)
    [orden] = db_session.scalars(select(OrdenCompra)).all()
    procesar_eventos_pendientes(db_session)
    assert [e[0] for e in envios.enviados] == [compras.email]
    assert "Papelera del Sur" in envios.enviados[0][1]

    # 3. La recepción avisa a quien pidió la compra.
    _recibir(db_session, orden, compras, cantidad=12)
    procesar_eventos_pendientes(db_session)
    assert [e[0] for e in envios.enviados] == [compras.email, solicitante.email]
    assert solicitud.id is not None
