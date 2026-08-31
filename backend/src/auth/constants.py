"""Vocabulario de la matriz de permisos.

Transcrito de `database/seeds/grupo-b.yaml`: `MODULOS`/`ACCIONES` son los strings de display
exactos que quedan guardados en `permiso.modulo` / `permiso.accion`, y lo que valida
`PermisoCreate`/`PermisoUpdate` vía los `Literal`.

La clave de autorización real es `permiso.codigo` (ver `codigo_de`), no el par
modulo+accion: un string con acentos y espacios es frágil como clave (una `ó` en NFD vs NFC no
matchea contra la misma fila en NFC, y el fallo es silencioso — deniega en vez de romper). Las
constantes `PERMISO_*` de acá abajo son lo que efectivamente se pasa a `requiere_permiso(...)`.
"""

import re
import unicodedata
from typing import Literal

MODULO_AUTENTICACION = "Autenticación"
MODULO_FAMILIAS_ALUMNOS = "Familias y Alumnos"
MODULO_ACADEMICO = "Académico"
MODULO_INSCRIPCIONES = "Inscripciones"
MODULO_FACTURACION = "Facturación"
MODULO_PROVEEDORES_COMPRAS = "Proveedores y Compras"
MODULO_WORKFLOWS = "Workflows"
MODULO_AUDITORIA = "Auditoría"
MODULO_PANEL_ADMIN = "Panel Administrativo"
MODULO_IA_SUGERENCIAS = "IA/Sugerencias"

MODULOS = (
    MODULO_AUTENTICACION,
    MODULO_FAMILIAS_ALUMNOS,
    MODULO_ACADEMICO,
    MODULO_INSCRIPCIONES,
    MODULO_FACTURACION,
    MODULO_PROVEEDORES_COMPRAS,
    MODULO_WORKFLOWS,
    MODULO_AUDITORIA,
    MODULO_PANEL_ADMIN,
    MODULO_IA_SUGERENCIAS,
)

ACCION_CREAR = "crear"
ACCION_LEER = "leer"
ACCION_ACTUALIZAR = "actualizar"
ACCION_ELIMINAR = "eliminar"
ACCION_EXPORTAR = "exportar"

ACCIONES = (
    ACCION_CREAR,
    ACCION_LEER,
    ACCION_ACTUALIZAR,
    ACCION_ELIMINAR,
    ACCION_EXPORTAR,
)

ModuloLiteral = Literal[
    "Autenticación",
    "Familias y Alumnos",
    "Académico",
    "Inscripciones",
    "Facturación",
    "Proveedores y Compras",
    "Workflows",
    "Auditoría",
    "Panel Administrativo",
    "IA/Sugerencias",
]

AccionLiteral = Literal["crear", "leer", "actualizar", "eliminar", "exportar"]


# --- Slug ASCII de módulo, usado para derivar el código de permiso ------------------------

SLUG_POR_MODULO: dict[str, str] = {
    MODULO_AUTENTICACION: "autenticacion",
    MODULO_FAMILIAS_ALUMNOS: "familias_alumnos",
    MODULO_ACADEMICO: "academico",
    MODULO_INSCRIPCIONES: "inscripciones",
    MODULO_FACTURACION: "facturacion",
    MODULO_PROVEEDORES_COMPRAS: "proveedores_compras",
    MODULO_WORKFLOWS: "workflows",
    MODULO_AUDITORIA: "auditoria",
    MODULO_PANEL_ADMIN: "panel_administrativo",
    MODULO_IA_SUGERENCIAS: "ia_sugerencias",
}


def _slug_de_modulo(modulo: str) -> str:
    """Fallback para un `modulo` fuera del vocabulario fijo: nunca debería pasar en un
    `Permiso` válido (el `Literal` lo impide en el ABM), pero una migración o un dato viejo
    podría traer uno. Deriva un slug razonable en vez de reventar."""
    conocido = SLUG_POR_MODULO.get(modulo)
    if conocido is not None:
        return conocido
    sin_acentos = unicodedata.normalize("NFKD", modulo).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "_", sin_acentos.lower()).strip("_")


def codigo_de(modulo: str, accion: str, tipo_informacion: str | None = None) -> str:
    """Clave de autorización estable y ASCII para un permiso.

    `tipo_informacion` entra en el código a propósito: así el UNIQUE de base sobre `codigo`
    reproduce exactamente la unicidad de (modulo, accion, tipo_informacion) que hoy solo
    valida `_permiso_duplicado` en Python.
    """
    base = f"{_slug_de_modulo(modulo)}.{accion}"
    if tipo_informacion is None:
        return base
    return f"{base}:{tipo_informacion}"


# --- Códigos de permiso usados en `requiere_permiso(...)` en los routers ------------------

PERMISO_AUTENTICACION_CREAR = codigo_de(MODULO_AUTENTICACION, ACCION_CREAR)
PERMISO_AUTENTICACION_LEER = codigo_de(MODULO_AUTENTICACION, ACCION_LEER)
PERMISO_AUTENTICACION_ACTUALIZAR = codigo_de(MODULO_AUTENTICACION, ACCION_ACTUALIZAR)
PERMISO_AUTENTICACION_ELIMINAR = codigo_de(MODULO_AUTENTICACION, ACCION_ELIMINAR)

PERMISO_FAMILIAS_ALUMNOS_CREAR = codigo_de(MODULO_FAMILIAS_ALUMNOS, ACCION_CREAR)
PERMISO_FAMILIAS_ALUMNOS_LEER = codigo_de(MODULO_FAMILIAS_ALUMNOS, ACCION_LEER)
PERMISO_FAMILIAS_ALUMNOS_ACTUALIZAR = codigo_de(MODULO_FAMILIAS_ALUMNOS, ACCION_ACTUALIZAR)
PERMISO_FAMILIAS_ALUMNOS_ELIMINAR = codigo_de(MODULO_FAMILIAS_ALUMNOS, ACCION_ELIMINAR)

PERMISO_ACADEMICO_CREAR = codigo_de(MODULO_ACADEMICO, ACCION_CREAR)
PERMISO_ACADEMICO_LEER = codigo_de(MODULO_ACADEMICO, ACCION_LEER)
PERMISO_ACADEMICO_ACTUALIZAR = codigo_de(MODULO_ACADEMICO, ACCION_ACTUALIZAR)
PERMISO_ACADEMICO_ELIMINAR = codigo_de(MODULO_ACADEMICO, ACCION_ELIMINAR)

PERMISO_INSCRIPCIONES_CREAR = codigo_de(MODULO_INSCRIPCIONES, ACCION_CREAR)
PERMISO_INSCRIPCIONES_LEER = codigo_de(MODULO_INSCRIPCIONES, ACCION_LEER)
PERMISO_INSCRIPCIONES_ACTUALIZAR = codigo_de(MODULO_INSCRIPCIONES, ACCION_ACTUALIZAR)

PERMISO_FACTURACION_CREAR = codigo_de(MODULO_FACTURACION, ACCION_CREAR)
PERMISO_FACTURACION_LEER = codigo_de(MODULO_FACTURACION, ACCION_LEER)
PERMISO_FACTURACION_ACTUALIZAR = codigo_de(MODULO_FACTURACION, ACCION_ACTUALIZAR)
PERMISO_FACTURACION_ELIMINAR = codigo_de(MODULO_FACTURACION, ACCION_ELIMINAR)

PERMISO_PROVEEDORES_COMPRAS_CREAR = codigo_de(MODULO_PROVEEDORES_COMPRAS, ACCION_CREAR)
PERMISO_PROVEEDORES_COMPRAS_LEER = codigo_de(MODULO_PROVEEDORES_COMPRAS, ACCION_LEER)
PERMISO_PROVEEDORES_COMPRAS_ACTUALIZAR = codigo_de(MODULO_PROVEEDORES_COMPRAS, ACCION_ACTUALIZAR)
PERMISO_PROVEEDORES_COMPRAS_ELIMINAR = codigo_de(MODULO_PROVEEDORES_COMPRAS, ACCION_ELIMINAR)
