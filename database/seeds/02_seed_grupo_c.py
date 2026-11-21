"""Carga NIVEL_EDUCATIVO desde grupo-c.yaml. Resto de Grupo C sigue bloqueado
(ver database/seeds/README.md).

Los niveles son un catálogo fijo. La migración `e0483c8d9e9c` los inserta como
"Inicial"/"Primario"/"Secundario" en una base vacía y este seed usa los nombres del
cliente ("Nivel Inicial", ...). Para no dejar filas duplicadas, el seed compara por
nombre normalizado (sin acentos, mayúsculas ni prefijo "nivel") y reutiliza la fila
existente. Una fila en uso nunca se renombra ni se borra: si ya tiene años o
solicitudes, se conserva y no se crea un equivalente.

Uso (desde backend/, con el venv activado):
    python ../database/seeds/02_seed_grupo_c.py
"""

import sys
import unicodedata
from pathlib import Path

try:
    import src  # noqa: F401  ya en sys.path (ej. PYTHONPATH=/app en Docker)
except ImportError:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

import yaml

from src.academico.models import Anio, NivelEducativo
from src.database import SessionLocal
from src.inscripciones.models import SolicitudInscripcion

YAML_PATH = Path(__file__).parent / "grupo-c.yaml"


def _clave(nombre: str) -> str:
    """Nombre comparable: sin acentos, minúsculas y sin el prefijo "nivel"."""
    sin_acentos = "".join(
        caracter
        for caracter in unicodedata.normalize("NFD", nombre)
        if unicodedata.category(caracter) != "Mn"
    )
    return " ".join(sin_acentos.lower().split()).removeprefix("nivel").strip()


def _en_uso(db, nivel_id) -> bool:
    return bool(
        db.query(Anio.id).filter_by(nivel_educativo_id=nivel_id).first()
        or db.query(SolicitudInscripcion.id).filter_by(nivel_educativo_id=nivel_id).first()
    )


def seed_grupo_c():
    data = yaml.safe_load(YAML_PATH.read_text())
    db = SessionLocal()
    try:
        print("nivel_educativo:")
        for item in data["nivel_educativo"]:
            nombre = item["nombre"]
            clave = _clave(nombre)
            niveles = db.query(NivelEducativo).all()
            mismo_nivel = [nivel for nivel in niveles if _clave(nivel.nombre) == clave]
            exacto = next((nivel for nivel in mismo_nivel if nivel.nombre == nombre), None)
            if exacto is not None:
                print(f"  ya existe: NivelEducativo({nombre!r})")
                continue

            reutilizable = next((nivel for nivel in mismo_nivel if not _en_uso(db, nivel.id)), None)
            if reutilizable is not None:
                anterior = reutilizable.nombre
                reutilizable.nombre = nombre
                print(f"  renombrado: NivelEducativo({anterior!r} -> {nombre!r})")
                continue

            if mismo_nivel:
                # Una fila equivalente está en uso: no se duplica el catálogo.
                print(
                    f"  se conserva: NivelEducativo({mismo_nivel[0].nombre!r}) en uso "
                    f"para {nombre!r}"
                )
                continue

            db.add(NivelEducativo(nombre=nombre))
            print(f"  creado: NivelEducativo({nombre!r})")

        db.flush()
        canonicos = {_clave(item["nombre"]) for item in data["nivel_educativo"]}
        for nivel in db.query(NivelEducativo).all():
            if _clave(nivel.nombre) not in canonicos or _en_uso(db, nivel.id):
                continue
            if nivel.nombre not in {item["nombre"] for item in data["nivel_educativo"]}:
                print(f"  eliminado: NivelEducativo({nivel.nombre!r}) duplicado sin uso")
                db.delete(nivel)
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed_grupo_c()
