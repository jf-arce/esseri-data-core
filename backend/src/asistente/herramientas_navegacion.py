"""`ir_a`: lleva a una pantalla del menú. El modelo elige una clave; la ruta la arma el frontend."""

from typing import Literal

from pydantic import BaseModel, Field

from src.asistente.constants import TIPO_ALIAS_ALUMNO, TIPO_ALIAS_FAMILIA
from src.asistente.herramientas_base import (
    ContextoHerramienta,
    Herramienta,
    ResultadoHerramienta,
)
from src.asistente.seudonimos_service import resolver_alias
from src.auth.constants import (
    PERMISO_ACADEMICO_LEER,
    PERMISO_AUTENTICACION_LEER,
    PERMISO_COMUNICACIONES_LEER,
    PERMISO_FACTURACION_LEER,
    PERMISO_FAMILIAS_ALUMNOS_LEER,
    PERMISO_INSCRIPCIONES_LEER,
    PERMISO_PANEL_ADMIN_LEER,
    PERMISO_PROVEEDORES_COMPRAS_LEER,
    PERMISO_WORKFLOWS_LEER,
)

# Clave de destino -> permiso que exige la pantalla. Las mismas claves existen en el frontend
# (`modules/asistente/utils.ts`), que además valida cada ruta contra el menú del rol.
DESTINOS: dict[str, str | None] = {
    "panel_direccion": PERMISO_PANEL_ADMIN_LEER,
    "panel_administrativo": PERMISO_PANEL_ADMIN_LEER,
    "comunicaciones": PERMISO_COMUNICACIONES_LEER,
    "familias": PERMISO_FAMILIAS_ALUMNOS_LEER,
    "alumnos": PERMISO_FAMILIAS_ALUMNOS_LEER,
    "academico": PERMISO_ACADEMICO_LEER,
    "materias": PERMISO_ACADEMICO_LEER,
    "asignaciones_docentes": PERMISO_ACADEMICO_LEER,
    "historial_asistencia": PERMISO_ACADEMICO_LEER,
    "inscripciones": PERMISO_INSCRIPCIONES_LEER,
    "admisiones": PERMISO_INSCRIPCIONES_LEER,
    "facturas": PERMISO_FACTURACION_LEER,
    "deuda_por_familia": PERMISO_FACTURACION_LEER,
    "reglas_facturacion": PERMISO_FACTURACION_LEER,
    "penalidades": PERMISO_FACTURACION_LEER,
    "proveedores": PERMISO_PROVEEDORES_COMPRAS_LEER,
    "solicitudes_compra": PERMISO_PROVEEDORES_COMPRAS_LEER,
    "ordenes_compra": PERMISO_PROVEEDORES_COMPRAS_LEER,
    "catalogo_compras": PERMISO_PROVEEDORES_COMPRAS_LEER,
    "reglas_workflows": PERMISO_WORKFLOWS_LEER,
    "ejecuciones": PERMISO_WORKFLOWS_LEER,
    "notificaciones": PERMISO_WORKFLOWS_LEER,
    "tareas": None,
    "usuarios": PERMISO_AUTENTICACION_LEER,
    "roles": PERMISO_AUTENTICACION_LEER,
}

DestinoClave = Literal[
    "panel_direccion",
    "panel_administrativo",
    "comunicaciones",
    "familias",
    "alumnos",
    "academico",
    "materias",
    "asignaciones_docentes",
    "historial_asistencia",
    "inscripciones",
    "admisiones",
    "facturas",
    "deuda_por_familia",
    "reglas_facturacion",
    "penalidades",
    "proveedores",
    "solicitudes_compra",
    "ordenes_compra",
    "catalogo_compras",
    "reglas_workflows",
    "ejecuciones",
    "notificaciones",
    "tareas",
    "usuarios",
    "roles",
]


class ParametrosIrA(BaseModel):
    destino: DestinoClave | None = Field(
        default=None, description="Pantalla del menú a la que llevar."
    )
    alias: str | None = Field(
        default=None,
        description="Alias de un alumno o familia, para abrir su ficha. Excluyente con destino.",
    )


def _ir_a(contexto: ContextoHerramienta, parametros: ParametrosIrA) -> ResultadoHerramienta:
    if (parametros.destino is None) == (parametros.alias is None):
        return ResultadoHerramienta(para_llm={"error": "Indicá destino o alias, no ambos."})

    if parametros.alias is not None:
        fila = resolver_alias(contexto.db, contexto.conversacion_id, parametros.alias)
        if not contexto.tiene_permiso(PERMISO_FAMILIAS_ALUMNOS_LEER):
            return ResultadoHerramienta(para_llm={"error": "El rol no puede ver esa ficha."})
        if fila.tipo not in (TIPO_ALIAS_ALUMNO, TIPO_ALIAS_FAMILIA):
            return ResultadoHerramienta(para_llm={"error": "Alias no navegable."})
        entidad = "alumno" if fila.tipo == TIPO_ALIAS_ALUMNO else "familia"
        return ResultadoHerramienta(
            para_llm={"boton_ir_listo": f"ficha de {entidad} {fila.alias}"},
            navegar={"entidad": entidad, "alias": fila.alias},
        )

    permiso = DESTINOS[parametros.destino or ""]
    if permiso is not None and not contexto.tiene_permiso(permiso):
        return ResultadoHerramienta(para_llm={"error": "El rol no tiene acceso a esa pantalla."})
    return ResultadoHerramienta(
        para_llm={"boton_ir_listo": parametros.destino},
        navegar={"destino": parametros.destino or ""},
    )


HERRAMIENTAS = [
    Herramienta(
        nombre="ir_a",
        descripcion=(
            "Deja un botón 'Ir ahí' hacia una pantalla del sistema (destino) o la ficha de un "
            "alumno o familia (alias); no navega sola. Usala solo si la persona pide 'llevame', "
            "'abrí' o 'mostrame la pantalla de'. Nunca como alternativa cuando no tenés una "
            "herramienta para responder."
        ),
        parametros=ParametrosIrA,
        permisos=(),
        ejecutar=_ir_a,
    )
]
