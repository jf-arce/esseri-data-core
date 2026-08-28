"""Vocabulario de la matriz de permisos.

Transcrito de `database/seeds/grupo-b.yaml`: son los strings exactos que quedan guardados en
`permiso.modulo` / `permiso.accion`. Sin esto, un typo en un `requiere_permiso(...)` fallaría en
silencio (denegando siempre) en vez de romper en el momento del cambio.
"""

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
