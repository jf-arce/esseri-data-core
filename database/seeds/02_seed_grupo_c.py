"""Carga NIVEL_EDUCATIVO desde grupo-c.yaml. Resto de Grupo C sigue bloqueado
(ver database/seeds/README.md).

Uso (desde backend/, con el venv activado):
    python ../database/seeds/02_seed_grupo_c.py
"""

import sys
from pathlib import Path

try:
    import src  # noqa: F401  ya en sys.path (ej. PYTHONPATH=/app en Docker)
except ImportError:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

import yaml

from src.academico.models import NivelEducativo
from src.database import SessionLocal

YAML_PATH = Path(__file__).parent / "grupo-c.yaml"


def seed_grupo_c():
    data = yaml.safe_load(YAML_PATH.read_text())
    db = SessionLocal()
    try:
        print("nivel_educativo:")
        for item in data["nivel_educativo"]:
            existing = db.query(NivelEducativo).filter_by(nombre=item["nombre"]).first()
            if existing:
                print(f"  ya existe: NivelEducativo({item['nombre']!r})")
                continue
            db.add(NivelEducativo(nombre=item["nombre"]))
            print(f"  creado: NivelEducativo({item['nombre']!r})")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed_grupo_c()
