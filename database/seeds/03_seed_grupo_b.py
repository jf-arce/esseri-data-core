"""Carga PERMISO + CAMPO_EVENTO desde grupo-b.yaml. Requiere Grupo A ya cargado.

Uso (desde backend/, con el venv activado):
    python ../database/seeds/03_seed_grupo_b.py
"""

import sys
from pathlib import Path

try:
    import src  # noqa: F401  ya en sys.path (ej. PYTHONPATH=/app en Docker)
except ImportError:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

import yaml

from src.auth.constants import codigo_de
from src.auth.models import Permiso, Rol
from src.database import SessionLocal
from src.workflows.models import CampoEvento, TipoEvento

YAML_PATH = Path(__file__).parent / "grupo-b.yaml"


def seed_permiso(db, data):
    print("permiso:")
    for entry in data["permiso"]:
        rol = db.query(Rol).filter_by(nombre=entry["rol"]).one()
        for accion in entry["acciones"]:
            # Permiso no tiene FK directa a rol (va vía ROL_PERMISO), así que el
            # chequeo de existencia es por `codigo` (clave estable, ver `codigo_de`).
            codigo = codigo_de(entry["modulo"], accion, entry.get("tipo_informacion"))
            existing = db.query(Permiso).filter_by(codigo=codigo).first()
            if existing:
                permiso = existing
                print(f"  ya existe: Permiso({entry['modulo']!r}, {accion!r})")
            else:
                permiso = Permiso(
                    modulo=entry["modulo"],
                    accion=accion,
                    tipo_informacion=entry.get("tipo_informacion"),
                )
                db.add(permiso)
                db.flush()
                print(f"  creado: Permiso({entry['modulo']!r}, {accion!r})")

            _link_rol_permiso(db, rol, permiso)


def _link_rol_permiso(db, rol, permiso):
    from src.auth.models import RolPermiso

    existing = (
        db.query(RolPermiso).filter_by(rol_id=rol.id, permiso_id=permiso.id).first()
    )
    if existing:
        return
    db.add(RolPermiso(rol_id=rol.id, permiso_id=permiso.id))
    print(f"    vinculado a rol {rol.nombre!r}")


def seed_campo_evento(db, data):
    print("campo_evento:")
    for tipo_evento_nombre, campos in data["campo_evento"].items():
        tipo_evento = db.query(TipoEvento).filter_by(nombre=tipo_evento_nombre).one()
        for campo in campos:
            existing = (
                db.query(CampoEvento)
                .filter_by(
                    nombre_interno=campo["nombre_interno"], tipo_evento_id=tipo_evento.id
                )
                .first()
            )
            if existing:
                print(f"  ya existe: CampoEvento({campo['nombre_interno']!r})")
                continue
            db.add(
                CampoEvento(
                    nombre_interno=campo["nombre_interno"],
                    etiqueta=campo["etiqueta"],
                    tipo_dato=campo["tipo_dato"],
                    tipo_evento_id=tipo_evento.id,
                )
            )
            print(f"  creado: CampoEvento({campo['nombre_interno']!r}) en {tipo_evento_nombre!r}")


def seed_grupo_b():
    data = yaml.safe_load(YAML_PATH.read_text())
    db = SessionLocal()
    try:
        seed_permiso(db, data)
        seed_campo_evento(db, data)
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed_grupo_b()
