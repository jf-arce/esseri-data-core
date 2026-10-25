"""Fixtures de Workflows: catálogo de eventos y usuario autenticado con permisos del módulo."""

import importlib.util
import sys
import uuid
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import pytest
from sqlalchemy import func, select

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
from src.familias_alumnos.models import Familia
from src.inscripciones.models import Asistencia
from src.workflows import n8n_client
from src.workflows.eventos_service import emit_event
from src.workflows.models import CampoEvento, TipoEvento, WorkflowExecution, WorkflowRule
from tests.inscripciones.factories import crear_escenario, crear_inscripcion_previa

PASSWORD_VALIDA = "una-contrasenia-larga"
SEED_DEMO = Path(__file__).resolve().parents[3] / "database" / "seeds" / "04_seed_demo.py"


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


def _ahora(db):
    """La hora de la base, la misma con la que se guardan los eventos y las reglas."""
    return db.scalar(select(func.localtimestamp()))


@pytest.fixture()
def familia(db_session):
    """Un alumno con inscripción activa y una familia con cuenta (el email al que se avisa)."""
    datos = crear_escenario(db_session)
    inscripcion = crear_inscripcion_previa(db_session, datos, estado="activa")

    persona_id = db_session.get(Familia, datos["familia_id"]).persona_id
    usuario = Usuario(
        email="madre@mail.com", auth_provider="local", password_hash="x", persona_id=persona_id
    )
    db_session.add(usuario)
    db_session.commit()
    return {"inscripcion_id": inscripcion.id, "email": usuario.email, "datos": datos}


def _asistencia(db, familia, tipo="ausente_pendiente"):
    asistencia = Asistencia(
        fecha=date(2027, 3, 3), tipo=tipo, inscripcion_id=familia["inscripcion_id"]
    )
    db.add(asistencia)
    db.commit()
    return asistencia


@pytest.fixture(scope="module")
def seed_demo():
    """El seed de demo no es un paquete (su nombre empieza con un número): se carga por ruta, sin
    escribir bytecode para no ensuciar `database/seeds/` con un `__pycache__`."""
    spec = importlib.util.spec_from_file_location("seed_demo", SEED_DEMO)
    modulo = importlib.util.module_from_spec(spec)
    previo = sys.dont_write_bytecode
    sys.dont_write_bytecode = True
    try:
        spec.loader.exec_module(modulo)
    finally:
        sys.dont_write_bytecode = previo
    return modulo


@pytest.fixture()
def tipos_inasistencia(db_session):
    """Los dos eventos de asistencia de Académico, con los campos del catálogo real."""
    registrada = TipoEvento(
        nombre="inasistencia.registrada", descripcion="Se registró una inasistencia o tardanza"
    )
    justificada = TipoEvento(
        nombre="inasistencia.justificada", descripcion="Se resolvió la justificación"
    )
    db_session.add_all([registrada, justificada])
    db_session.flush()
    campos = {
        registrada: [
            ("alumno_nombre", "texto"),
            ("fecha", "fecha"),
            ("tipo_asistencia", "texto"),
        ],
        justificada: [
            ("alumno_nombre", "texto"),
            ("fecha_resolucion", "fecha"),
            ("motivo", "texto"),
        ],
    }
    for tipo, definiciones in campos.items():
        db_session.add_all(
            CampoEvento(
                nombre_interno=nombre, etiqueta=nombre, tipo_dato=tipo_dato, tipo_evento_id=tipo.id
            )
            for nombre, tipo_dato in definiciones
        )
    db_session.commit()
    return {"registrada": registrada, "justificada": justificada}


@pytest.fixture()
def envios(monkeypatch):
    """Registra los emails enviados; `fallar` lista los destinatarios cuyo envío lanza."""

    class Registro:
        enviados: list[tuple[str, str, str]]
        intentos: list[str]
        fallar: dict[str, Exception]

    registro = Registro()
    registro.enviados = []
    registro.intentos = []
    registro.fallar = {}

    def enviar(destinatario, asunto, cuerpo, transport=None):
        registro.intentos.append(destinatario)
        if destinatario in registro.fallar:
            raise registro.fallar[destinatario]
        registro.enviados.append((destinatario, asunto, cuerpo))

    monkeypatch.setattr(n8n_client, "enviar_email", enviar)
    return registro


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
