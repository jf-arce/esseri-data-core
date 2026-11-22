"""Shared free-text search normalization: one rule for every user-facing search."""

from sqlalchemy import select

from src.models import Persona
from src.search import (
    contiene_texto_busqueda,
    normalizar_texto_busqueda,
    patron_busqueda,
)


def test_pliega_mayusculas_tildes_y_enye():
    assert normalizar_texto_busqueda("  INÉS  ") == "ines"
    assert normalizar_texto_busqueda("Peña") == "pena"
    assert normalizar_texto_busqueda("Ñandú") == "nandu"
    assert normalizar_texto_busqueda("GÓMEZ") == "gomez"


def test_el_patron_conserva_los_comodines_del_usuario_como_literales():
    assert patron_busqueda("50%_x") == "%50\\%\\_x%"
    assert patron_busqueda("Peña") == "%pena%"


def test_la_condicion_encuentra_nombres_sin_tildes(db_session):
    db_session.add_all(
        [
            Persona(nombre="Inés", apellido="Peña", dni="1"),
            Persona(nombre="Ana", apellido="Pérez", dni="2"),
        ]
    )
    db_session.flush()

    encontrados = db_session.scalars(
        select(Persona.nombre).where(contiene_texto_busqueda(Persona.nombre, "INES"))
    ).all()

    assert encontrados == ["Inés"]


def test_la_condicion_encuentra_por_apellido_con_enye(db_session):
    db_session.add_all(
        [
            Persona(nombre="Inés", apellido="Peña", dni="1"),
            Persona(nombre="Ana", apellido="Pérez", dni="2"),
        ]
    )
    db_session.flush()

    encontrados = db_session.scalars(
        select(Persona.apellido).where(contiene_texto_busqueda(Persona.apellido, "pena"))
    ).all()

    assert encontrados == ["Peña"]
