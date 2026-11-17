"""Búsqueda de alumnos y familias con `solo_nombre` (el `@` del Asistente): sin DNI."""

import pytest

from src.familias_alumnos.models import Alumno, Familia
from src.familias_alumnos.schemas import FiltrosListarAlumnos, FiltrosListarFamilias
from src.familias_alumnos.service import listar_alumnos, listar_familias
from src.models import Persona


@pytest.fixture()
def personas(db_session):
    """Ana Pérez (DNI con 1), Juan Gómez (DNI con 1) y Marta Díaz (DNI sin 1)."""
    for nombre, apellido, dni in (
        ("Ana", "Pérez", "40111111"),
        ("Juan", "Gómez", "40222211"),
        ("Marta", "Díaz", "20333333"),
    ):
        persona = Persona(nombre=nombre, apellido=apellido, dni=dni)
        db_session.add(persona)
        db_session.flush()
        db_session.add(Alumno(numero_legajo=f"L-{dni}", estado="activo", persona_id=persona.id))
        db_session.add(Familia(persona_id=persona.id, estado_deuda="al_dia"))
    db_session.commit()


def _alumnos(db, buscar: str, *, solo_nombre: bool) -> list[str]:
    filtros = FiltrosListarAlumnos(buscar=buscar, solo_nombre=solo_nombre)
    return sorted(a.persona.apellido for a in listar_alumnos(db, filtros))


def _familias(db, buscar: str, *, solo_nombre: bool) -> list[str]:
    filtros = FiltrosListarFamilias(buscar=buscar, solo_nombre=solo_nombre)
    return sorted(f.persona.apellido for f in listar_familias(db, filtros))


def test_por_defecto_el_dni_sigue_contando(db_session, personas):
    assert _alumnos(db_session, "1", solo_nombre=False) == ["Gómez", "Pérez"]
    assert _familias(db_session, "1", solo_nombre=False) == ["Gómez", "Pérez"]


def test_solo_nombre_ignora_el_dni(db_session, personas):
    assert _alumnos(db_session, "1", solo_nombre=True) == []
    assert _familias(db_session, "40111111", solo_nombre=True) == []


def test_solo_nombre_busca_por_nombre_o_apellido_sin_tildes(db_session, personas):
    assert _alumnos(db_session, "ana", solo_nombre=True) == ["Pérez"]
    assert _alumnos(db_session, "PEREZ", solo_nombre=True) == ["Pérez"]
    assert _familias(db_session, "dia", solo_nombre=True) == ["Díaz"]


def test_solo_nombre_junta_las_palabras_en_cualquier_orden(db_session, personas):
    assert _alumnos(db_session, "perez ana", solo_nombre=True) == ["Pérez"]
    assert _alumnos(db_session, "ana gomez", solo_nombre=True) == []


def test_solo_nombre_sin_palabras_no_filtra(db_session, personas):
    assert len(_alumnos(db_session, "%", solo_nombre=True)) == 3
