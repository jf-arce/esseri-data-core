"""Fixtures de Workflows: catálogo de eventos y usuario autenticado con permisos del módulo."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from src.auth import sesion_service
from src.auth.constants import (
    ACCION_ACTUALIZAR,
    ACCION_CREAR,
    ACCION_ELIMINAR,
    ACCION_LEER,
    MODULO_WORKFLOWS,
)
from src.auth.models import Permiso, Rol, RolPermiso, Usuario, UsuarioRol
from src.facturacion.models import ConceptoCobro, ReglaPenalidad
from src.workflows.eventos_service import emit_event
from src.workflows.models import CampoEvento, TipoEvento, WorkflowExecution, WorkflowRule

PASSWORD_VALIDA = "una-contrasenia-larga"


@pytest.fixture()
def tipo_factura_vencida(db_session):
    tipo = TipoEvento(
        nombre="factura.vencida", descripcion="Una factura impaga superó su fecha de vencimiento"
    )
    db_session.add(tipo)
    db_session.flush()
    db_session.add_all(
        [
            CampoEvento(
                nombre_interno="dias_vencido",
                etiqueta="Días",
                tipo_dato="numero",
                tipo_evento_id=tipo.id,
            ),
            CampoEvento(
                nombre_interno="monto_deuda",
                etiqueta="Monto",
                tipo_dato="numero",
                tipo_evento_id=tipo.id,
            ),
            CampoEvento(
                nombre_interno="nombre_familia",
                etiqueta="Familia",
                tipo_dato="texto",
                tipo_evento_id=tipo.id,
            ),
        ]
    )
    db_session.commit()
    return tipo


@pytest.fixture()
def concepto_cobro(db_session):
    concepto = ConceptoCobro(nombre="Penalidad por mora", activo=True)
    db_session.add(concepto)
    db_session.commit()
    return concepto


@pytest.fixture()
def regla_penalidad(db_session, concepto_cobro):
    regla = ReglaPenalidad(
        desde_dia_vencido=6,
        hasta_dia_vencido=15,
        porcentaje=20,
        activo=True,
        concepto_cobro_id=concepto_cobro.id,
    )
    db_session.add(regla)
    db_session.commit()
    return regla


def _crear_usuario_con_permisos(db_session, email: str, acciones: tuple[str, ...]) -> Usuario:
    usuario = Usuario(
        email=email,
        password_hash=sesion_service.hashear_password(PASSWORD_VALIDA),
        auth_provider="local",
        estado="activo",
    )
    rol = Rol(nombre=f"rol {email}")
    db_session.add_all([usuario, rol])
    db_session.flush()
    for accion in acciones:
        permiso = Permiso(modulo=MODULO_WORKFLOWS, accion=accion)
        db_session.add(permiso)
        db_session.flush()
        db_session.add(RolPermiso(rol_id=rol.id, permiso_id=permiso.id))
    db_session.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol.id))
    db_session.commit()
    return usuario


def _login(client, usuario: Usuario):
    respuesta = client.post(
        "/auth/login", json={"email": usuario.email, "password": PASSWORD_VALIDA}
    )
    assert respuesta.status_code == 200
    return client


@pytest.fixture()
def usuario_workflows(db_session):
    return _crear_usuario_con_permisos(
        db_session,
        "workflows@esseri.edu.ar",
        (ACCION_CREAR, ACCION_LEER, ACCION_ACTUALIZAR, ACCION_ELIMINAR),
    )


@pytest.fixture()
def client_autenticado(client, usuario_workflows):
    return _login(client, usuario_workflows)


@pytest.fixture()
def client_solo_lectura(client, db_session):
    usuario = _crear_usuario_con_permisos(db_session, "lector@esseri.edu.ar", (ACCION_LEER,))
    return _login(client, usuario)


def ahora_utc_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def crear_ejecucion(
    db,
    tipo_evento,
    *,
    estado="fallido",
    intento=1,
    started_at=None,
    nombre="Avisar mora",
    requiere_aprobacion_humana=False,
):
    regla = WorkflowRule(
        nombre=nombre,
        condicion={},
        tipo_accion="notificar",
        accion_config={"destinatario": "responsables_habilitados"},
        criticidad="media",
        requiere_aprobacion_humana=requiere_aprobacion_humana,
        activo=True,
        tipo_evento_id=tipo_evento.id,
    )
    db.add(regla)
    db.commit()
    evento = emit_event(
        db,
        tipo="factura.vencida",
        entidad="factura",
        entidad_id=uuid.uuid4(),
        payload={"dias_vencido": 6, "monto_deuda": 100},
    )
    evento.estado = "procesado"
    db.commit()
    inicio = started_at or ahora_utc_naive()
    ejecucion = WorkflowExecution(
        intento=intento,
        started_at=inicio,
        finished_at=inicio + timedelta(seconds=1) if estado != "pendiente" else None,
        estado=estado,
        error_detail="falló el envío" if estado == "fallido" else None,
        detalle="Esperando aprobación humana." if estado == "pendiente" else None,
        workflow_rule_id=regla.id,
        event_log_id=evento.id,
    )
    db.add(ejecucion)
    db.commit()
    return regla, evento, ejecucion
