"""Carga el catálogo Grupo A desde grupo-a.yaml. Idempotente.

Uso (desde backend/, con el venv activado):
    python ../database/seeds/01_seed_grupo_a.py
"""

import sys
from pathlib import Path

try:
    import src  # noqa: F401  ya en sys.path (ej. PYTHONPATH=/app en Docker)
except ImportError:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

import yaml

from src.academico.models import MotivoJustificacion
from src.auth.models import Rol
from src.database import SessionLocal
from src.facturacion.models import ConceptoCobro, MetodoPago, ReglaPenalidad
from src.workflows.models import TipoEvento

YAML_PATH = Path(__file__).parent / "grupo-a.yaml"


def _get_or_create(db, model, nombre, **extra):
    existing = db.query(model).filter_by(nombre=nombre).first()
    if existing:
        print(f"  ya existe: {model.__name__}({nombre!r})")
        return existing
    row = model(nombre=nombre, **extra)
    db.add(row)
    db.flush()
    print(f"  creado: {model.__name__}({nombre!r})")
    return row


def seed_grupo_a():
    data = yaml.safe_load(YAML_PATH.read_text())
    db = SessionLocal()
    try:
        print("rol:")
        for item in data["rol"]:
            _get_or_create(db, Rol, item["nombre"])

        print("tipo_evento:")
        for item in data["tipo_evento"]:
            _get_or_create(db, TipoEvento, item["nombre"], descripcion=item.get("descripcion"))

        print("metodo_pago:")
        for item in data["metodo_pago"]:
            _get_or_create(
                db,
                MetodoPago,
                item["nombre"],
                requiere_comprobante=item["requiere_comprobante"],
                activo=True,
            )

        print("concepto_cobro:")
        for item in data["concepto_cobro"]:
            _get_or_create(db, ConceptoCobro, item["nombre"], activo=True)

        print("motivo_justificacion:")
        for item in data["motivo_justificacion"]:
            _get_or_create(db, MotivoJustificacion, item["nombre"], activo=True)

        print("regla_penalidad:")
        for item in data["regla_penalidad"]:
            concepto = (
                db.query(ConceptoCobro).filter_by(nombre=item["concepto_cobro"]).one()
            )
            existing = (
                db.query(ReglaPenalidad)
                .filter_by(desde_dia_vencido=item["desde_dia_vencido"])
                .first()
            )
            if existing:
                print(f"  ya existe: ReglaPenalidad(desde_dia_vencido={item['desde_dia_vencido']})")
                continue
            db.add(
                ReglaPenalidad(
                    desde_dia_vencido=item["desde_dia_vencido"],
                    hasta_dia_vencido=item["hasta_dia_vencido"],
                    porcentaje=item["porcentaje"],
                    concepto_cobro_id=concepto.id,
                    activo=True,
                )
            )
            print(f"  creado: ReglaPenalidad(desde_dia_vencido={item['desde_dia_vencido']})")

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed_grupo_a()
