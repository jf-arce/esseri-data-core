"""Idempotent synthetic seed for the stage-3 real-browser proof.

This is NOT a pytest fixture: it persists a small, deterministic scenario in the dedicated
isolated PostgreSQL database so a separate Playwright process can perform real logins and real
HTTP calls against the running backend. It never runs against the shared or test databases.

Safety guards, in order:

- `DATABASE_URL` must point at the isolated stage-3 browser database (`127.0.0.1:54389`,
  `communications_stage3_e2e`); any other host, port or database name aborts before connecting.
- `ENVIRONMENT` must not be production.
- `STAGE3_E2E_PASSWORD` must be supplied explicitly; the password itself is never printed,
  stored in logs or written anywhere. Each run restores the synthetic accounts' hash.

Idempotency uses natural keys only (DNI, email, legajo, role name, permission code, ciclo +
alumno, docente + materia + división), mirroring `database/seeds/05_seed_demo_docente.py`, so
re-running after a browser session does not duplicate rows and does not reuse random UUIDs.

Usage (from `backend/`, with the authorized interpreter):

    BASE=postgresql+psycopg://communications:communications-test-only@127.0.0.1:54389
    DATABASE_URL=$BASE/communications_stage3_e2e JWT_SECRET=stage3-test-only \
    STAGE3_E2E_PASSWORD=<explicit synthetic password> \
    python tests/comunicaciones/seed_e2e.py
"""

from __future__ import annotations

import json
import os
import sys
from datetime import date
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.engine import make_url

try:
    import src  # noqa: F401  # running from backend/ already resolves it
except ImportError:
    sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "backend"))

from src.academico.models import (
    Anio,
    AsignacionDocente,
    Division,
    Docente,
    Materia,
    NivelEducativo,
)
from src.auth.constants import codigo_de
from src.auth.models import Permiso, Rol, RolPermiso, Usuario, UsuarioRol
from src.auth.sesion_service import hashear_password
from src.config import settings
from src.database import SessionLocal
from src.familias_alumnos.models import Alumno, Familia, FamiliaAlumno
from src.inscripciones.models import Inscripcion
from src.models import Persona

DB_NAME = "communications_stage3_e2e"
DB_HOST = "127.0.0.1"
DB_PORT = 54389
CICLO_LECTIVO = "2027"
DIVISION_NOMBRE = "4° B"

ADMIN = {
    "email": "stage3.admin@esseri.test",
    "nombre": "Administración",
    "apellido": "Stage3",
    "dni": "99000001",
}
DOCENTE = {
    "email": "stage3.docente@esseri.test",
    "nombre": "Laura",
    "apellido": "Díaz",
    "dni": "99000002",
    "legajo": "DOC-STAGE3",
}
FAMILIA = {
    "email": "stage3.familia@esseri.test",
    "nombre": "Marina",
    "apellido": "Gómez",
    "dni": "99000003",
}
FAMILIA_AJENA = {
    "email": "stage3.otra-familia@esseri.test",
    "nombre": "Diego",
    "apellido": "Pérez",
    "dni": "99000004",
}
ALUMNO = {
    "nombre": "Tomás",
    "apellido": "Gómez",
    "dni": "98000001",
    "legajo": "ALU-STAGE3-01",
}
ALUMNO_AJENO = {
    "nombre": "Sofía",
    "apellido": "Pérez",
    "dni": "98000002",
    "legajo": "ALU-STAGE3-02",
}

ROLES = {
    "administracion": {
        "nombre": "administración",
        "permisos": [
            ("Comunicaciones", "crear"),
            ("Comunicaciones", "leer"),
            ("Comunicaciones", "actualizar"),
        ],
    },
    "docente": {
        "nombre": "docente",
        "permisos": [
            ("Comunicaciones", "crear", "docente"),
            ("Comunicaciones", "leer", "docente"),
            ("Comunicaciones", "actualizar", "docente"),
        ],
    },
    "familia": {
        "nombre": "familia",
        "permisos": [("Comunicaciones", "leer")],
    },
}


def _abort(mensaje: str) -> None:
    print(f"seed_e2e: {mensaje}", file=sys.stderr)
    raise SystemExit(1)


def validar_destino() -> None:
    """Refuse anything that is not the explicitly isolated stage-3 browser database."""
    if settings.ENVIRONMENT.strip().lower() in {"production", "prod"}:
        _abort("bloqueado en producción")
    if not settings.DATABASE_URL.startswith("postgresql"):
        _abort("DATABASE_URL debe ser PostgreSQL, nunca SQLite ni otra base")
    url = make_url(settings.DATABASE_URL)
    if url.drivername != "postgresql+psycopg":
        _abort(f"el driver debe ser postgresql+psycopg, no {url.drivername!r}")
    if url.database != DB_NAME:
        _abort(f"la base debe llamarse {DB_NAME!r}, no {url.database!r}")
    if url.host != DB_HOST or url.port != DB_PORT:
        _abort(f"el destino debe ser {DB_HOST}:{DB_PORT}, no {url.host}:{url.port}")
    if not os.getenv("STAGE3_E2E_PASSWORD", "").strip():
        _abort("definí STAGE3_E2E_PASSWORD con una contraseña sintética explícita")


def _persona(db, datos: dict) -> Persona:
    fila = db.scalar(select(Persona).where(Persona.dni == datos["dni"]).limit(1))
    if fila is None:
        fila = Persona(nombre=datos["nombre"], apellido=datos["apellido"], dni=datos["dni"])
        db.add(fila)
        db.flush()
    else:
        fila.nombre = datos["nombre"]
        fila.apellido = datos["apellido"]
    return fila


def _rol(db, codigo: str, nombre: str) -> Rol:
    fila = db.scalar(select(Rol).where(Rol.codigo == codigo).limit(1))
    if fila is None:
        fila = Rol(nombre=nombre)
        db.add(fila)
        db.flush()
    return fila


def _permiso(db, modulo: str, accion: str, tipo: str | None = None) -> Permiso:
    codigo = codigo_de(modulo, accion, tipo)
    fila = db.scalar(select(Permiso).where(Permiso.codigo == codigo).limit(1))
    if fila is None:
        fila = Permiso(modulo=modulo, accion=accion, tipo_informacion=tipo)
        db.add(fila)
        db.flush()
    return fila


def _vincular_permiso(db, rol: Rol, permiso: Permiso) -> None:
    existe = db.scalar(
        select(RolPermiso.id).where(
            RolPermiso.rol_id == rol.id, RolPermiso.permiso_id == permiso.id
        )
    )
    if existe is None:
        db.add(RolPermiso(rol_id=rol.id, permiso_id=permiso.id))


def _vincular_rol(db, usuario: Usuario, rol: Rol) -> None:
    existe = db.scalar(
        select(UsuarioRol.id).where(
            UsuarioRol.usuario_id == usuario.id, UsuarioRol.rol_id == rol.id
        )
    )
    if existe is None:
        db.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol.id))


def _usuario(db, datos: dict, persona_id, password_hash: str) -> Usuario:
    fila = db.scalar(select(Usuario).where(Usuario.email == datos["email"]).limit(1))
    if fila is None:
        fila = Usuario(
            email=datos["email"],
            password_hash=password_hash,
            auth_provider="local",
            estado="activo",
            persona_id=persona_id,
        )
        db.add(fila)
    else:
        # Dedicated synthetic accounts: every run restores deterministic access.
        fila.password_hash = password_hash
        fila.auth_provider = "local"
        fila.estado = "activo"
        fila.persona_id = persona_id
    db.flush()
    return fila


def _asegurar_roles(db) -> dict[str, Rol]:
    roles: dict[str, Rol] = {}
    for codigo, definicion in ROLES.items():
        rol = _rol(db, codigo, definicion["nombre"])
        for definicion_permiso in definicion["permisos"]:
            permiso = _permiso(
                db,
                definicion_permiso[0],
                definicion_permiso[1],
                definicion_permiso[2] if len(definicion_permiso) > 2 else None,
            )
            _vincular_permiso(db, rol, permiso)
        roles[codigo] = rol
    db.flush()
    return roles


def _nivel_primario(db) -> NivelEducativo:
    nivel = db.scalar(
        select(NivelEducativo).where(NivelEducativo.nombre == "Nivel Primario").limit(1)
    )
    if nivel is None:
        nivel = NivelEducativo(nombre="Nivel Primario")
        db.add(nivel)
        db.flush()
    return nivel


def _anio(db, nivel_id) -> Anio:
    anio = db.scalar(
        select(Anio).where(Anio.nivel_educativo_id == nivel_id, Anio.numero == 4).limit(1)
    )
    if anio is None:
        anio = Anio(numero=4, nivel_educativo_id=nivel_id)
        db.add(anio)
        db.flush()
    return anio


def _division(db, anio_id) -> Division:
    division = db.scalar(
        select(Division)
        .where(Division.anio_id == anio_id, Division.nombre == DIVISION_NOMBRE)
        .limit(1)
    )
    if division is None:
        division = Division(nombre=DIVISION_NOMBRE, anio_id=anio_id)
        db.add(division)
        db.flush()
    return division


def _materia(db, anio_id, division_id) -> Materia:
    materia = db.scalar(
        select(Materia)
        .where(
            Materia.anio_id == anio_id,
            Materia.division_id == division_id,
            Materia.nombre == "Lengua",
        )
        .limit(1)
    )
    if materia is None:
        materia = Materia(nombre="Lengua", tipo="materia", anio_id=anio_id, division_id=division_id)
        db.add(materia)
        db.flush()
    return materia


def _alumno(db, datos: dict) -> Alumno:
    fila = db.scalar(select(Alumno).where(Alumno.numero_legajo == datos["legajo"]).limit(1))
    persona = _persona(db, datos)
    if fila is None:
        fila = Alumno(numero_legajo=datos["legajo"], estado="activo", persona_id=persona.id)
        db.add(fila)
        db.flush()
    else:
        fila.estado = "activo"
        fila.persona_id = persona.id
    return fila


def _familia(db, datos: dict) -> Familia:
    persona = _persona(db, datos)
    fila = db.scalar(select(Familia).where(Familia.persona_id == persona.id).limit(1))
    if fila is None:
        fila = Familia(persona_id=persona.id, estado_deuda="al_dia")
        db.add(fila)
        db.flush()
    return fila


def _vincular_alumno(db, familia_id, alumno_id) -> None:
    existe = db.scalar(
        select(FamiliaAlumno.id).where(
            FamiliaAlumno.familia_id == familia_id,
            FamiliaAlumno.alumno_id == alumno_id,
        )
    )
    if existe is None:
        db.add(
            FamiliaAlumno(
                familia_id=familia_id,
                alumno_id=alumno_id,
                parentesco="madre",
                responsable_principal=True,
                recibe_comunicaciones=True,
            )
        )


def _inscripcion(db, alumno_id, division_id) -> Inscripcion:
    fila = db.scalar(
        select(Inscripcion)
        .where(
            Inscripcion.alumno_id == alumno_id,
            Inscripcion.ciclo_lectivo == CICLO_LECTIVO,
        )
        .limit(1)
    )
    if fila is None:
        fila = Inscripcion(
            ciclo_lectivo=CICLO_LECTIVO,
            fecha_inscripcion=date(2026, 10, 30),
            tipo="nueva",
            estado="activa",
            alumno_id=alumno_id,
            division_id=division_id,
        )
        db.add(fila)
        db.flush()
    else:
        fila.estado = "activa"
        fila.division_id = division_id
    return fila


def _asignacion(db, docente_id, materia_id, division_id) -> None:
    existe = db.scalar(
        select(AsignacionDocente.id).where(
            AsignacionDocente.ciclo_lectivo == CICLO_LECTIVO,
            AsignacionDocente.docente_id == docente_id,
            AsignacionDocente.materia_id == materia_id,
            AsignacionDocente.division_id == division_id,
        )
    )
    if existe is None:
        db.add(
            AsignacionDocente(
                ciclo_lectivo=CICLO_LECTIVO,
                docente_id=docente_id,
                materia_id=materia_id,
                division_id=division_id,
            )
        )


def _docente(db, persona_id) -> Docente:
    fila = db.scalar(select(Docente).where(Docente.legajo == DOCENTE["legajo"]).limit(1))
    if fila is None:
        fila = Docente(legajo=DOCENTE["legajo"], persona_id=persona_id)
        db.add(fila)
        db.flush()
    else:
        fila.persona_id = persona_id
    return fila


def sembrar() -> dict:
    password = os.environ["STAGE3_E2E_PASSWORD"].strip()
    password_hash = hashear_password(password)
    db = SessionLocal()
    try:
        roles = _asegurar_roles(db)

        nivel = _nivel_primario(db)
        anio = _anio(db, nivel.id)
        division = _division(db, anio.id)
        materia = _materia(db, anio.id, division.id)

        persona_docente = _persona(db, DOCENTE)
        docente = _docente(db, persona_docente.id)
        _asignacion(db, docente.id, materia.id, division.id)

        alumno = _alumno(db, ALUMNO)
        alumno_ajeno = _alumno(db, ALUMNO_AJENO)
        _inscripcion(db, alumno.id, division.id)
        # The unrelated student stays out of the 2027 division on purpose: its family must not
        # receive either the institutional or the course message.

        familia = _familia(db, FAMILIA)
        familia_ajena = _familia(db, FAMILIA_AJENA)
        _vincular_alumno(db, familia.id, alumno.id)
        _vincular_alumno(db, familia_ajena.id, alumno_ajeno.id)

        persona_admin = _persona(db, ADMIN)
        admin = _usuario(db, ADMIN, persona_admin.id, password_hash)
        _vincular_rol(db, admin, roles["administracion"])
        docente_usuario = _usuario(db, DOCENTE, persona_docente.id, password_hash)
        _vincular_rol(db, docente_usuario, roles["docente"])
        familia_usuario = _usuario(db, FAMILIA, familia.persona_id, password_hash)
        _vincular_rol(db, familia_usuario, roles["familia"])
        familia_ajena_usuario = _usuario(db, FAMILIA_AJENA, familia_ajena.persona_id, password_hash)
        _vincular_rol(db, familia_ajena_usuario, roles["familia"])

        db.commit()

        return {
            "admin": ADMIN["email"],
            "docente": DOCENTE["email"],
            "familia": FAMILIA["email"],
            "familia_ajena": FAMILIA_AJENA["email"],
            "password_env": "STAGE3_E2E_PASSWORD",
            "division": DIVISION_NOMBRE,
            "ciclo_lectivo": CICLO_LECTIVO,
            "asignatura_docente": "Lengua",
        }
    finally:
        db.close()


def main() -> None:
    validar_destino()
    resumen = sembrar()
    print(json.dumps(resumen, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
