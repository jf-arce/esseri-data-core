"""Carga datos ficticios para demostrar el Portal Docente (RF-04: asistencia de a un alumno).

Dataset separado de `04_seed_demo.py` a propósito: sirve para la demo puntual del flujo de
asistencia, con nombres/legajos propios que no se cruzan con los de ese seed general.

Reutiliza los datos que el equipo ya había cargado a mano en el ambiente compartido (la
docente Jorgelina Moralejo, la división "3°C" y los alumnos Botteri/Cangiani) en vez de
duplicarlos, para que correr este seed en una base ya usada no cree filas de más — y en una
base nueva (sin esa carga manual previa) los crea desde cero.

OJO — deuda de datos conocida, no resuelta acá: `Division.nombre` está pensado como el sufijo
suelto ("A", "B" — ver `04_seed_demo.py` y `nivel-seccion.tsx`, que arma "1°A" concatenando
`Anio.numero` + el nombre), pero la división "3°C" ya cargada en el ambiente compartido tiene
el año pegado en el propio nombre Y un `Anio.numero` que no coincide (año 1, no 3). Corregirlo
tocaría datos ya probados en vivo antes de la demo de hoy, así que se deja como está — este
seed sigue la misma convención (nombre completo) solo para la división nueva "2°B", para al
menos no sumar un segundo caso con el año mal.

Mismas reglas de seguridad que `04_seed_demo.py`:
- Nunca corre en producción.
- Requiere ESSERI_DEMO_SEED_ENABLED=true (confirmación explícita).
- Idempotente por claves naturales (DNI, legajo, email, nombre de división): correrlo de
  nuevo no duplica filas.

Uso (desde backend/, con el venv activado):
    ESSERI_DEMO_SEED_ENABLED=true python ../database/seeds/05_seed_demo_docente.py

Login de la cuenta docente creada: docente.prueba@esseri.edu.ar / prueba-2027
(la contraseña puede sobreescribirse con ESSERI_DEMO_DOCENTE_PASSWORD).
"""

from __future__ import annotations

import os
import sys
from datetime import date
from pathlib import Path

from sqlalchemy import func, select

try:
    import src  # noqa: F401
except ImportError:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from src.academico.models import (
    Anio,
    AsignacionDocente,
    Division,
    Docente,
    Materia,
    NivelEducativo,
)
from src.auth.models import Rol, Usuario, UsuarioRol
from src.auth.sesion_service import hashear_password
from src.config import settings
from src.database import SessionLocal
from src.familias_alumnos.models import Alumno
from src.inscripciones.models import Inscripcion
from src.models import Persona

ROL_DOCENTE = "docente"
DOCENTE_EMAIL = "docente.prueba@esseri.edu.ar"
DOCENTE_PASSWORD = os.getenv("ESSERI_DEMO_DOCENTE_PASSWORD", "prueba-2027")
CICLO_LECTIVO = "2026"

# Diez alumnos nuevos para "3°C" (además de Botteri/Cangiani ya cargados), para que la toma de
# asistencia tenga una lista larga en la demo. Legajos ALU-00003 en adelante: 00001/00002 ya
# están tomados por Botteri/Cangiani.
ALUMNOS_3C = [
    ("51100001", "Mateo", "Fernández", "ALU-00003"),
    ("51100002", "Sofía", "Giménez", "ALU-00004"),
    ("51100003", "Lucas", "Herrera", "ALU-00005"),
    ("51100004", "Valentina", "Ibarra", "ALU-00006"),
    ("51100005", "Thiago", "Juárez", "ALU-00007"),
    ("51100006", "Martina", "Acosta", "ALU-00008"),
    ("51100007", "Bautista", "Silva", "ALU-00009"),
    ("51100008", "Isabella", "Núñez", "ALU-00010"),
    ("51100009", "Santino", "Paredes", "ALU-00011"),
    ("51100010", "Renata", "Vargas", "ALU-00012"),
]


def _persona(db, dni: str, nombre: str, apellido: str) -> Persona:
    row = db.scalar(select(Persona).where(Persona.dni == dni).limit(1))
    if row is None:
        row = Persona(nombre=nombre, apellido=apellido, dni=dni)
        db.add(row)
        db.flush()
    else:
        row.nombre = nombre
        row.apellido = apellido
    return row


def _ensure_docente_jorgelina(db) -> Docente:
    persona = _persona(db, "40100001", "Jorgelina", "Moralejo")

    docente = db.scalar(select(Docente).where(Docente.legajo == "DOC001").limit(1))
    if docente is None:
        docente = Docente(legajo="DOC001", persona_id=persona.id)
        db.add(docente)
        db.flush()
    else:
        docente.persona_id = persona.id

    rol = db.scalar(select(Rol).where(Rol.nombre == ROL_DOCENTE).limit(1))
    if rol is None:
        raise RuntimeError("Falta el rol 'docente'. Corré primero 01_seed_grupo_a.py.")

    usuario = db.scalar(select(Usuario).where(Usuario.email == DOCENTE_EMAIL).limit(1))
    if usuario is None:
        usuario = Usuario(
            email=DOCENTE_EMAIL,
            password_hash=hashear_password(DOCENTE_PASSWORD),
            auth_provider="local",
            estado="activo",
            persona_id=persona.id,
        )
        db.add(usuario)
        db.flush()
    else:
        # Cuenta exclusivamente demo: se restaura acceso determinístico en cada corrida, igual
        # que `_ensure_demo_user` de 04_seed_demo.py.
        usuario.password_hash = hashear_password(DOCENTE_PASSWORD)
        usuario.auth_provider = "local"
        usuario.estado = "activo"
        usuario.persona_id = persona.id

    vinculo = db.scalar(
        select(UsuarioRol).where(UsuarioRol.usuario_id == usuario.id, UsuarioRol.rol_id == rol.id)
    )
    if vinculo is None:
        db.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol.id))
    db.flush()
    return docente


def _nivel_primario(db) -> NivelEducativo:
    nivel = db.scalar(
        select(NivelEducativo).where(NivelEducativo.nombre == "Nivel Primario").limit(1)
    )
    if nivel is None:
        raise RuntimeError("Falta 'Nivel Primario'. Corré primero 02_seed_grupo_c.py.")
    return nivel


def _ensure_anio(db, nivel_id, numero: int) -> Anio:
    anio = db.scalar(
        select(Anio).where(Anio.nivel_educativo_id == nivel_id, Anio.numero == numero).limit(1)
    )
    if anio is None:
        anio = Anio(numero=numero, nivel_educativo_id=nivel_id)
        db.add(anio)
        db.flush()
    return anio


def _ensure_division_3c(db) -> Division:
    """Reutiliza la división "3°C" tal como ya está en el ambiente compartido (ver nota de
    deuda de datos arriba) -- no se toca su Año ni se renombra. Si no existe (base nueva, sin
    la carga manual previa), se crea con Año 3 -- al menos ahí sin el desfasaje conocido."""
    division = db.scalar(select(Division).where(Division.nombre == "3°C").limit(1))
    if division is not None:
        return division
    nivel = _nivel_primario(db)
    anio = _ensure_anio(db, nivel.id, 3)
    division = Division(nombre="3°C", anio_id=anio.id)
    db.add(division)
    db.flush()
    return division


def _ensure_division_2b(db) -> Division:
    nivel = _nivel_primario(db)
    anio = _ensure_anio(db, nivel.id, 2)
    division = db.scalar(
        select(Division).where(Division.anio_id == anio.id, Division.nombre == "2°B").limit(1)
    )
    if division is None:
        division = Division(nombre="2°B", anio_id=anio.id)
        db.add(division)
        db.flush()
    return division


def _ensure_materia(db, anio_id, division_id, nombre: str) -> Materia:
    row = db.scalar(
        select(Materia)
        .where(
            Materia.anio_id == anio_id,
            Materia.division_id == division_id,
            Materia.nombre == nombre,
        )
        .limit(1)
    )
    if row is None:
        row = Materia(nombre=nombre, tipo="materia", anio_id=anio_id, division_id=division_id)
        db.add(row)
        db.flush()
    return row


def _ensure_asignacion(db, docente_id, materia_id, division_id) -> None:
    existente = db.scalar(
        select(AsignacionDocente)
        .where(
            AsignacionDocente.ciclo_lectivo == CICLO_LECTIVO,
            AsignacionDocente.docente_id == docente_id,
            AsignacionDocente.materia_id == materia_id,
            AsignacionDocente.division_id == division_id,
        )
        .limit(1)
    )
    if existente is None:
        db.add(
            AsignacionDocente(
                ciclo_lectivo=CICLO_LECTIVO,
                docente_id=docente_id,
                materia_id=materia_id,
                division_id=division_id,
            )
        )
        db.flush()


def _ensure_alumnos_3c(db, division_id) -> None:
    for dni, nombre, apellido, legajo in ALUMNOS_3C:
        persona = _persona(db, dni, nombre, apellido)
        alumno = db.scalar(select(Alumno).where(Alumno.numero_legajo == legajo).limit(1))
        if alumno is None:
            alumno = Alumno(numero_legajo=legajo, estado="activo", persona_id=persona.id)
            db.add(alumno)
            db.flush()
        else:
            alumno.estado = "activo"
            alumno.persona_id = persona.id

        inscripcion = db.scalar(
            select(Inscripcion)
            .where(
                Inscripcion.alumno_id == alumno.id,
                Inscripcion.ciclo_lectivo == CICLO_LECTIVO,
            )
            .limit(1)
        )
        if inscripcion is None:
            db.add(
                Inscripcion(
                    ciclo_lectivo=CICLO_LECTIVO,
                    fecha_inscripcion=date(int(CICLO_LECTIVO), 3, 2),
                    tipo="nueva",
                    estado="activa",
                    alumno_id=alumno.id,
                    division_id=division_id,
                    solicitud_inscripcion_id=None,
                )
            )
        else:
            inscripcion.estado = "activa"
            inscripcion.division_id = division_id
    db.flush()


def seed_demo_docente() -> None:
    if settings.ENVIRONMENT.strip().lower() in {"production", "prod"}:
        sys.exit("Este seed está bloqueado en producción.")
    if os.getenv("ESSERI_DEMO_SEED_ENABLED", "").strip().lower() not in {"1", "true", "yes"}:
        sys.exit(
            "Confirmá la carga con ESSERI_DEMO_SEED_ENABLED=true; "
            "el seed crea datos ficticios de demo."
        )

    db = SessionLocal()
    try:
        print("[1/3] Docente Jorgelina Moralejo + cuenta de acceso")
        docente = _ensure_docente_jorgelina(db)
        db.commit()

        print("[2/3] División 3°C (reutilizada) + 10 alumnos nuevos")
        division_3c = _ensure_division_3c(db)
        _ensure_alumnos_3c(db, division_3c.id)
        db.commit()

        print("[3/3] División 2°B (nueva) asignada a Jorgelina")
        division_2b = _ensure_division_2b(db)
        materia_2b = _ensure_materia(db, division_2b.anio_id, division_2b.id, "Lengua")
        _ensure_asignacion(db, docente.id, materia_2b.id, division_2b.id)
        db.commit()

        total_3c = db.scalar(
            select(func.count(Inscripcion.id)).where(
                Inscripcion.division_id == division_3c.id, Inscripcion.estado == "activa"
            )
        )
        print("\nSeed listo.")
        print(f"  Login docente: {DOCENTE_EMAIL} / {DOCENTE_PASSWORD}")
        print(f"  3°C: {total_3c} alumnos activos")
        print("  2°B: división nueva, sin alumnos todavía.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_docente()
