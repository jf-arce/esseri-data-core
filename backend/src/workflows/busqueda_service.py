"""Búsqueda de valores para campos del evento que apuntan a una persona o un producto (alumno,
familia, artículo). El texto que devuelve es idéntico al que arma el módulo que emite el evento:
la condición compara con `==`, así que tiene que coincidir carácter por carácter."""

import uuid
from collections.abc import Callable
from itertools import islice

import sqlalchemy as sa
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.familias_alumnos.models import Alumno, Familia
from src.models import Persona
from src.proveedores_compras.models import ProductoServicio
from src.search import normalizar_texto_busqueda
from src.workflows.constants import BUSQUEDA_POR_CAMPO, FuenteBusqueda
from src.workflows.models import CampoEvento, TipoEvento
from src.workflows.schemas import OpcionCampoRead

LIMITE_BUSQUEDA = 20


def _consulta(fuente: FuenteBusqueda) -> tuple[sa.ColumnElement[str], sa.Select[tuple[str]]]:
    """La expresión del texto y la consulta base (sin filtrar) de cada fuente."""
    if fuente in ("alumno_apellido_nombre", "alumno_nombre_apellido"):
        texto = (
            Persona.apellido + ", " + Persona.nombre
            if fuente == "alumno_apellido_nombre"
            else Persona.nombre + " " + Persona.apellido
        )
        return texto, select(texto).join(Alumno, Alumno.persona_id == Persona.id)
    if fuente in ("familia_apellido_nombre", "familia_apellido"):
        texto = (
            Persona.apellido + ", " + Persona.nombre
            if fuente == "familia_apellido_nombre"
            else Persona.apellido
        )
        return texto, select(texto).join(Familia, Familia.persona_id == Persona.id)
    return ProductoServicio.nombre, select(ProductoServicio.nombre).where(ProductoServicio.activo)


def buscar(db: Session, fuente: FuenteBusqueda, q: str) -> list[OpcionCampoRead]:
    # Se filtra en Python para ignorar tildes igual en SQLite y en Postgres; los padrones de
    # alumnos y familias de un colegio son chicos.
    texto, consulta = _consulta(fuente)
    termino = normalizar_texto_busqueda(q.strip())
    valores = (
        v
        for v in db.scalars(consulta.distinct().order_by(texto))
        if termino in normalizar_texto_busqueda(v)
    )
    return [OpcionCampoRead(valor=v, etiqueta=v) for v in islice(valores, LIMITE_BUSQUEDA)]


def existe(db: Session, fuente: FuenteBusqueda, valor: str) -> bool:
    texto, consulta = _consulta(fuente)
    return db.scalar(sa.select(consulta.where(texto == valor).exists())) is True


def verificadores_de_campos(
    db: Session, tipo_evento_nombre: str
) -> dict[str, Callable[[str], bool]]:
    """Para cada campo del evento con búsqueda cerrada, cómo saber si un valor existe. Los campos
    que admiten "otro" (texto libre) no figuran."""
    return {
        campo: (lambda valor, fuente=fuente: existe(db, fuente, valor))
        for (evento, campo), (fuente, permite_otro) in BUSQUEDA_POR_CAMPO.items()
        if evento == tipo_evento_nombre and not permite_otro
    }


def buscar_en_campo(db: Session, campo_id: uuid.UUID, q: str) -> list[OpcionCampoRead] | None:
    """`None` si el campo no tiene búsqueda."""
    fila = db.execute(
        select(CampoEvento.nombre_interno, TipoEvento.nombre)
        .join(TipoEvento, TipoEvento.id == CampoEvento.tipo_evento_id)
        .where(CampoEvento.id == campo_id)
    ).first()
    if fila is None:
        return None
    config = BUSQUEDA_POR_CAMPO.get((fila.nombre, fila.nombre_interno))
    return None if config is None else buscar(db, config[0], q)
