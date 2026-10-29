"""generar_comunicacion (#213): arma el mensaje como `notificar` pero lo deja en revisión en la
bandeja de Sugerencias; recién al aprobarlo se envía."""

import pytest
from sqlalchemy import select

from src.auth.models import Usuario
from src.ia_sugerencias.models import IaSugerencia
from src.ia_sugerencias.service import (
    aprobar_sugerencia,
    armar_respuesta,
    rechazar_sugerencia,
)
from src.proveedores_compras.schemas import ProductoServicioCreate, SolicitudCompraCreate
from src.proveedores_compras.service import (
    cambiar_estado_solicitud,
    crear_producto_servicio,
    crear_solicitud,
)
from src.workflows.despacho_service import procesar_eventos_pendientes
from src.workflows.models import (
    Notificacion,
    NotificacionTemplate,
    TipoEvento,
    WorkflowExecution,
    WorkflowRule,
)
from tests.proveedores_compras.conftest import catalogo_eventos_compras  # noqa: F401


def _usuario(db, email):
    usuario = Usuario(email=email, auth_provider="local", password_hash="x", estado="activo")
    db.add(usuario)
    db.commit()
    return usuario


@pytest.fixture()
def solicitante(db_session):
    return _usuario(db_session, "pide@esseri.edu.ar")


@pytest.fixture()
def revisor(db_session):
    return _usuario(db_session, "direccion@esseri.edu.ar")


@pytest.fixture()
def regla(db_session):
    plantilla = NotificacionTemplate(
        nombre="Pedido aprobado",
        asunto="Aprobamos tu pedido de {{item}}",
        cuerpo="Se aprobaron {{cantidad}} unidad(es).",
    )
    db_session.add(plantilla)
    db_session.flush()
    tipo = db_session.scalar(
        select(TipoEvento).where(TipoEvento.nombre == "solicitud_compra.aprobada")
    )
    regla = WorkflowRule(
        nombre="Avisar pedido aprobado",
        condicion={},
        tipo_accion="generar_comunicacion",
        accion_config={"destinatario": "solicitante"},
        criticidad="baja",
        requiere_aprobacion_humana=False,
        activo=True,
        tipo_evento_id=tipo.id,
        notificacion_template_id=plantilla.id,
    )
    db_session.add(regla)
    db_session.commit()
    return regla


def _disparar(db, usuario):
    producto = crear_producto_servicio(
        db, ProductoServicioCreate(nombre="Resma A4", tipo="producto")
    )
    solicitud = crear_solicitud(
        db, SolicitudCompraCreate(producto_servicio_id=producto.id, cantidad=12), usuario.id
    )
    cambiar_estado_solicitud(db, solicitud, "aprobada", usuario.id)
    procesar_eventos_pendientes(db)


def _sugerencia(db):
    return db.scalars(select(IaSugerencia)).one()


def test_deja_la_comunicacion_en_revision_sin_enviarla(db_session, regla, solicitante, envios):
    _disparar(db_session, solicitante)

    ejecucion = db_session.scalars(select(WorkflowExecution)).one()
    assert ejecucion.estado == "exitoso"
    assert "en revisión" in ejecucion.detalle
    sugerencia = _sugerencia(db_session)
    assert (sugerencia.tipo, sugerencia.estado) == ("comunicacion", "pendiente_revision")
    assert (sugerencia.entidad, sugerencia.entidad_id) == ("workflow_execution", ejecucion.id)
    envio = armar_respuesta(db_session, sugerencia).envio
    assert envio.asunto == "Aprobamos tu pedido de Resma A4"
    assert envio.cuerpo == "Se aprobaron 12 unidad(es)."
    assert [d.email for d in envio.destinatarios] == ["pide@esseri.edu.ar"]
    assert envios.enviados == []
    assert db_session.scalars(select(Notificacion)).all() == []


def test_aprobar_la_envia_y_la_registra_en_la_ejecucion(
    db_session, regla, solicitante, revisor, envios
):
    _disparar(db_session, solicitante)

    aprobar_sugerencia(db_session, _sugerencia(db_session), revisor.id)

    assert envios.enviados == [
        ("pide@esseri.edu.ar", "Aprobamos tu pedido de Resma A4", "Se aprobaron 12 unidad(es).")
    ]
    ejecucion = db_session.scalars(select(WorkflowExecution)).one()
    [notificacion] = db_session.scalars(select(Notificacion)).all()
    assert notificacion.workflow_execution_id == ejecucion.id
    assert notificacion.estado_envio == "enviado"
    assert ejecucion.detalle.startswith("Comunicación aprobada")
    assert _sugerencia(db_session).estado == "aprobada"
    # No crea una plantilla: eso es solo para los borradores de plantilla (#50).
    assert _sugerencia(db_session).notificacion_template_id is None


def test_rechazar_la_descarta_sin_enviar(db_session, regla, solicitante, revisor, envios):
    _disparar(db_session, solicitante)

    rechazar_sugerencia(db_session, _sugerencia(db_session), revisor.id)

    assert envios.enviados == []
    assert db_session.scalars(select(Notificacion)).all() == []
    assert _sugerencia(db_session).estado == "rechazada"


def test_sin_plantilla_falla_sin_dejar_borrador(db_session, regla, solicitante, envios):
    regla.notificacion_template_id = None
    db_session.commit()

    _disparar(db_session, solicitante)

    ejecucion = db_session.scalars(select(WorkflowExecution)).one()
    assert ejecucion.estado == "fallido"
    assert db_session.scalars(select(IaSugerencia)).all() == []
