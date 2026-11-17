"""Descarga de las tablas que el Asistente mostró en una conversación (CSV o Excel)."""

import re
import unicodedata
import uuid
from typing import Any, Literal

from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.asistente.constants import BLOQUE_TABLA, ESTADO_MENSAJE_DESCARTADO
from src.asistente.exceptions import TablaNoEncontrada
from src.asistente.models import Conversacion, MensajeAsistente
from src.asistente.seudonimos_service import resolver_aliases
from src.auth.exceptions import PermisoDenegado
from src.exports import respuesta_csv, respuesta_xlsx

FormatoExport = Literal["csv", "xlsx"]


def _buscar_tabla(db: Session, conversacion: Conversacion, tabla_id: str) -> dict[str, Any]:
    listas = db.scalars(
        select(MensajeAsistente.tarjetas).where(
            MensajeAsistente.conversacion_id == conversacion.id,
            MensajeAsistente.tarjetas.is_not(None),
            MensajeAsistente.estado != ESTADO_MENSAJE_DESCARTADO,
        )
    )
    for bloques in listas:
        for bloque in bloques or []:
            if bloque.get("tipo") == BLOQUE_TABLA and bloque.get("tabla_id") == tabla_id:
                return bloque
    raise TablaNoEncontrada()


def _nombres_de_alias(
    db: Session, conversacion: Conversacion, tabla: dict[str, Any], claves: list[str]
) -> dict[str, str]:
    """Nombre real de cada alias de la tabla, con la misma regla de permisos que `/resolver`.
    Sin permiso, el alias no se resuelve y queda como texto."""
    aliases = {str(fila[clave]) for fila in tabla["filas"] for clave in claves if fila.get(clave)}
    if not aliases:
        return {}
    try:
        resueltos = resolver_aliases(
            db,
            conversacion_id=conversacion.id,
            usuario_id=conversacion.usuario_id,
            rol_codigo=conversacion.rol_codigo,
            aliases=sorted(aliases),
        )
    except PermisoDenegado:
        return {}
    return {r.alias: r.nombre for r in resueltos}


def _nombre_de_archivo(titulo: str) -> str:
    # NFKD separa la tilde de la letra: "período" queda "periodo" y no "perodo".
    sin_tildes = unicodedata.normalize("NFKD", titulo.lower()).encode("ascii", "ignore").decode()
    base = re.sub(r"[^a-z0-9]+", "-", sin_tildes).strip("-")
    return base or "tabla"


def exportar_tabla(
    db: Session, conversacion: Conversacion, tabla_id: uuid.UUID, formato: FormatoExport
) -> StreamingResponse:
    tabla = _buscar_tabla(db, conversacion, str(tabla_id))
    columnas: list[dict[str, str]] = tabla["columnas"]
    claves_alias = [c["clave"] for c in columnas if c["tipo"] == "alias"]
    nombres = _nombres_de_alias(db, conversacion, tabla, claves_alias)

    def celda(clave: str, fila: dict[str, Any]) -> object:
        valor = fila.get(clave)
        return nombres.get(valor, valor) if clave in claves_alias else valor

    encabezados = [c["etiqueta"] for c in columnas]
    filas = [[celda(c["clave"], fila) for c in columnas] for fila in tabla["filas"]]
    nombre = _nombre_de_archivo(tabla["titulo"])
    if formato == "xlsx":
        return respuesta_xlsx(nombre, encabezados, filas)
    # En el CSV, las celdas vacías son vacías y no "None".
    return respuesta_csv(nombre, encabezados, [["" if v is None else v for v in f] for f in filas])
