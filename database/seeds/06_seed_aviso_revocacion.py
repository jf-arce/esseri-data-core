"""Carga la regla y la plantilla canónicas del aviso de revocación de ausencias por período.

Requiere los seeds 01 (tipos de evento) y 03 (campos de evento) ya cargados. Es idempotente: si
la plantilla o la regla ya existen por nombre, no se modifican, así que volver a correrlo no
duplica ni pisa lo editado desde la pantalla de Workflows.

Uso (desde backend/, con el venv activado):
    python ../database/seeds/06_seed_aviso_revocacion.py
"""

import sys
from pathlib import Path

try:
    import src  # noqa: F401  ya en sys.path (ej. PYTHONPATH=/app en Docker)
except ImportError:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from sqlalchemy import select

from src.database import SessionLocal
from src.workflows.models import CampoEvento, NotificacionTemplate, TipoEvento, WorkflowRule
from src.workflows.plantillas_service import crear_plantilla, extraer_placeholders
from src.workflows.schemas import NotificacionTemplateCreate, WorkflowRuleCreate
from src.workflows.service import crear_regla

EVENTO = "solicitud_ausencia_periodo.revocada"

PLANTILLA = {
    "nombre": "Solicitud de ausencia revocada",
    "asunto": "Solicitud de ausencia de {{alumno_nombre}} revocada",
    "cuerpo": (
        "Estimada familia:\n\n"
        "Les informamos que se revocó la solicitud de ausencia de {{alumno_nombre}} para el "
        "período {{fecha_inicio}} a {{fecha_fin}}. Motivo: {{motivo}}.\n\n"
        "Saludos cordiales."
    ),
}

REGLA = {
    "nombre": "Solicitud de ausencia revocada: avisar a la familia",
    "condicion": {},
    "tipo_accion": "notificar",
    "accion_config": {"destinatario": "responsables_habilitados"},
    "criticidad": "baja",
}


def _tipo_evento(db) -> TipoEvento:
    tipo_evento = db.scalar(select(TipoEvento).where(TipoEvento.nombre == EVENTO))
    if tipo_evento is None:
        raise SystemExit(
            f"Falta el tipo de evento {EVENTO!r}: corré 01_seed_grupo_a.py antes de este seed."
        )
    return tipo_evento


def _validar_campos(db, tipo_evento: TipoEvento) -> None:
    campos = set(
        db.scalars(
            select(CampoEvento.nombre_interno).where(CampoEvento.tipo_evento_id == tipo_evento.id)
        )
    )
    faltantes = extraer_placeholders(PLANTILLA["asunto"], PLANTILLA["cuerpo"]) - campos
    if faltantes:
        raise SystemExit(
            f"Faltan campos de evento para {EVENTO!r}: {', '.join(sorted(faltantes))}. "
            "Corré 03_seed_grupo_b.py antes de este seed."
        )


def seed(db) -> None:
    tipo_evento = _tipo_evento(db)
    _validar_campos(db, tipo_evento)

    plantilla = db.scalar(
        select(NotificacionTemplate).where(NotificacionTemplate.nombre == PLANTILLA["nombre"])
    )
    if plantilla is None:
        plantilla = crear_plantilla(db, NotificacionTemplateCreate(**PLANTILLA))
        print(f"  creado: NotificacionTemplate({PLANTILLA['nombre']!r})")
    else:
        print(f"  ya existe: NotificacionTemplate({PLANTILLA['nombre']!r})")

    regla = db.scalar(select(WorkflowRule).where(WorkflowRule.nombre == REGLA["nombre"]))
    if regla is None:
        regla = crear_regla(
            db,
            WorkflowRuleCreate(
                nombre=REGLA["nombre"],
                tipo_evento_id=tipo_evento.id,
                condicion=REGLA["condicion"],
                tipo_accion=REGLA["tipo_accion"],
                accion_config=REGLA["accion_config"],
                criticidad=REGLA["criticidad"],
                notificacion_template_id=plantilla.id,
            ),
        )
        print(f"  creado: WorkflowRule({REGLA['nombre']!r})")
    else:
        print(f"  ya existe: WorkflowRule({REGLA['nombre']!r})")


def main() -> None:
    with SessionLocal() as db:
        print("aviso de revocación de ausencias por período:")
        seed(db)
    print("Seed listo.")


if __name__ == "__main__":
    main()
