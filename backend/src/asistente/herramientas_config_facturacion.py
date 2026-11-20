"""Configuración de facturación (reglas, ejecuciones, recargos, conceptos) y ayuda conceptual."""

from typing import Any, Literal

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.academico.models import Anio, Division, NivelEducativo
from src.asistente.herramientas_base import (
    ContextoHerramienta,
    Herramienta,
    ResultadoHerramienta,
    agregar_tabla,
    bloque_tabla,
    fecha_ar,
    mes_ar,
    numero,
)
from src.auth.constants import PERMISO_FACTURACION_LEER
from src.facturacion.facturas_service import listar_metodos_pago
from src.facturacion.models import ConceptoCobro
from src.facturacion.penalidades_service import listar_reglas_penalidad
from src.facturacion.reglas_facturacion_service import (
    listar_ejecuciones_facturacion,
    listar_reglas_facturacion_read,
)
from src.facturacion.schemas import ReglaFacturacionRead

_FUENTE = "Configuración de facturación"
_MAX_FILAS = 50


class ParametrosConfiguracion(BaseModel):
    seccion: Literal["reglas", "ejecuciones", "penalidades", "conceptos", "metodos_pago"] = Field(
        description=(
            "reglas: reglas de facturación; ejecuciones: últimas corridas; penalidades: tramos "
            "de recargo por mora; conceptos: conceptos de cobro; metodos_pago: métodos de pago."
        )
    )
    estado: str | None = Field(
        default=None,
        description=(
            "Reglas: borrador, activa, pausada o finalizada. Ejecuciones: exitosa, parcial o "
            "fallida. Penalidades, conceptos y métodos de pago: activo o inactivo."
        ),
    )
    ciclo_lectivo: str | None = Field(
        default=None, pattern=r"^[1-9]\d{3}$", description="Solo para reglas, por ejemplo 2026."
    )


def _alcance(db: Session, regla: ReglaFacturacionRead) -> str:
    if regla.criterio_aplicacion == "todas_inscripciones":
        return "todas las inscripciones"
    if regla.criterio_aplicacion == "nivel" and regla.nivel_educativo_id:
        nivel = db.get(NivelEducativo, regla.nivel_educativo_id)
        return f"nivel {nivel.nombre}" if nivel else "un nivel"
    if regla.criterio_aplicacion == "anio" and regla.anio_id:
        anio = db.get(Anio, regla.anio_id)
        return f"año {anio.numero}" if anio else "un año"
    if regla.division_id:
        division = db.get(Division, regla.division_id)
        return f"división {division.nombre}" if division else "una división"
    return regla.criterio_aplicacion


def _reglas(
    contexto: ContextoHerramienta, parametros: ParametrosConfiguracion
) -> list[dict[str, Any]]:
    conceptos = {c.id: c.nombre for c in contexto.db.scalars(select(ConceptoCobro))}
    filas = []
    for regla in listar_reglas_facturacion_read(contexto.db):
        if parametros.estado and regla.estado != parametros.estado:
            continue
        if parametros.ciclo_lectivo and regla.ciclo_lectivo != parametros.ciclo_lectivo:
            continue
        filas.append(
            {
                "regla": regla.nombre,
                "concepto": conceptos.get(regla.concepto_cobro_id, "Sin concepto"),
                "importe": numero(regla.importe),
                "periodicidad": regla.periodicidad,
                "alcance": _alcance(contexto.db, regla),
                "ciclo": regla.ciclo_lectivo,
                "estado": regla.estado,
                "generacion": regla.modo_generacion,
                "dia_de_vencimiento": regla.dia_vencimiento,
                "proxima_generacion": (
                    fecha_ar(regla.proxima_generacion) if regla.proxima_generacion else None
                ),
            }
        )
    return filas


_COLUMNAS_REGLAS = [
    {"clave": "regla", "etiqueta": "Regla", "tipo": "texto"},
    {"clave": "concepto", "etiqueta": "Concepto", "tipo": "texto"},
    {"clave": "importe", "etiqueta": "Importe", "tipo": "moneda"},
    {"clave": "periodicidad", "etiqueta": "Periodicidad", "tipo": "texto"},
    {"clave": "alcance", "etiqueta": "Alcance", "tipo": "texto"},
    {"clave": "estado", "etiqueta": "Estado", "tipo": "texto"},
    {"clave": "proxima_generacion", "etiqueta": "Próxima generación", "tipo": "texto"},
]


def _ejecuciones(
    contexto: ContextoHerramienta, parametros: ParametrosConfiguracion
) -> list[dict[str, Any]]:
    filas = []
    for ejecucion in listar_ejecuciones_facturacion(contexto.db, limite=_MAX_FILAS):
        if parametros.estado and ejecucion.estado != parametros.estado:
            continue
        filas.append(
            {
                "fecha": fecha_ar(ejecucion.fecha_ejecucion.date()),
                "periodo": mes_ar(ejecucion.periodo.year, ejecucion.periodo.month),
                "origen": ejecucion.origen,
                "estado": ejecucion.estado,
                "facturas_generadas": ejecucion.facturas_generadas,
                "cargos_omitidos": ejecucion.cargos_omitidos,
                "cargos_bloqueados": ejecucion.cargos_bloqueados,
                "monto_total": numero(ejecucion.monto_total),
            }
        )
    return filas


_COLUMNAS_EJECUCIONES = [
    {"clave": "fecha", "etiqueta": "Fecha", "tipo": "texto"},
    {"clave": "periodo", "etiqueta": "Período", "tipo": "texto"},
    {"clave": "origen", "etiqueta": "Origen", "tipo": "texto"},
    {"clave": "estado", "etiqueta": "Estado", "tipo": "texto"},
    {"clave": "facturas_generadas", "etiqueta": "Facturas", "tipo": "numero"},
    {"clave": "monto_total", "etiqueta": "Monto", "tipo": "moneda"},
]


def _activo(parametros: ParametrosConfiguracion, activo: bool) -> bool:
    return parametros.estado is None or (parametros.estado == "activo") == activo


def _penalidades(
    contexto: ContextoHerramienta, parametros: ParametrosConfiguracion
) -> list[dict[str, Any]]:
    conceptos = {c.id: c.nombre for c in contexto.db.scalars(select(ConceptoCobro))}
    return [
        {
            "desde_dia_de_atraso": regla.desde_dia_vencido,
            "hasta_dia_de_atraso": regla.hasta_dia_vencido,
            "porcentaje": numero(regla.porcentaje),
            "concepto": conceptos.get(regla.concepto_cobro_id, "Sin concepto"),
            "activo": regla.activo,
        }
        for regla in listar_reglas_penalidad(contexto.db)
        if _activo(parametros, regla.activo)
    ]


_COLUMNAS_PENALIDADES = [
    {"clave": "desde_dia_de_atraso", "etiqueta": "Desde (días)", "tipo": "numero"},
    {"clave": "hasta_dia_de_atraso", "etiqueta": "Hasta (días)", "tipo": "numero"},
    {"clave": "porcentaje", "etiqueta": "Recargo %", "tipo": "numero"},
    {"clave": "concepto", "etiqueta": "Concepto", "tipo": "texto"},
]


def _conceptos(
    contexto: ContextoHerramienta, parametros: ParametrosConfiguracion
) -> list[dict[str, Any]]:
    return [
        {"concepto": c.nombre, "categoria": c.categoria, "activo": c.activo}
        for c in contexto.db.scalars(select(ConceptoCobro).order_by(ConceptoCobro.nombre))
        if _activo(parametros, c.activo)
    ]


_COLUMNAS_CONCEPTOS = [
    {"clave": "concepto", "etiqueta": "Concepto", "tipo": "texto"},
    {"clave": "categoria", "etiqueta": "Categoría", "tipo": "texto"},
]


def _metodos(
    contexto: ContextoHerramienta, parametros: ParametrosConfiguracion
) -> list[dict[str, Any]]:
    return [
        {
            "metodo": m.nombre,
            "activo": m.activo,
            "requiere_comprobante": m.requiere_comprobante,
        }
        for m in listar_metodos_pago(contexto.db)
        if _activo(parametros, m.activo)
    ]


_COLUMNAS_METODOS = [{"clave": "metodo", "etiqueta": "Método de pago", "tipo": "texto"}]

_SECCIONES = {
    "reglas": ("Reglas de facturación", _reglas, _COLUMNAS_REGLAS),
    "ejecuciones": ("Últimas ejecuciones de facturación", _ejecuciones, _COLUMNAS_EJECUCIONES),
    "penalidades": ("Recargos por mora", _penalidades, _COLUMNAS_PENALIDADES),
    "conceptos": ("Conceptos de cobro", _conceptos, _COLUMNAS_CONCEPTOS),
    "metodos_pago": ("Métodos de pago", _metodos, _COLUMNAS_METODOS),
}


def _configuracion_facturacion(
    contexto: ContextoHerramienta, parametros: ParametrosConfiguracion
) -> ResultadoHerramienta:
    titulo, obtener, columnas = _SECCIONES[parametros.seccion]
    filas = obtener(contexto, parametros)
    devueltas = filas[: min(_MAX_FILAS, contexto.max_filas * 3)]
    periodo = f"al {fecha_ar(contexto.hoy)}"
    tabla = bloque_tabla(titulo, columnas, devueltas, periodo=periodo, fuente=_FUENTE)
    bloques: list[dict[str, Any]] = []
    agregar_tabla(bloques, tabla)
    return ResultadoHerramienta(
        para_llm={
            "seccion": parametros.seccion,
            "periodo": periodo,
            "fuente": _FUENTE,
            "total": len(filas),
            "devueltas": len(devueltas),
            "filas": devueltas,
        },
        bloques=bloques,
        destino_sugerido=None,
    )


# --- ayuda_facturacion ----------------------------------------------------------------------

Tema = Literal[
    "cuenta_corriente",
    "vencimientos",
    "recargos",
    "excepciones_de_vencimiento",
    "generacion_automatica",
    "debitos",
    "responsable_economico",
    "portal_familia",
]

AYUDA: dict[str, str] = {
    "cuenta_corriente": (
        "La deuda sale de la cuenta corriente de cada alumno, un libro de movimientos que no se "
        "edita: cada cargo, pago y recargo es una fila nueva y un error se corrige con un "
        "movimiento de ajuste. El saldo no se guarda: se calcula sumando los movimientos al "
        "consultar. La deuda de una familia es la suma de los saldos impagos de las facturas de "
        "las que es responsable económica. Una factura figura como pagada solo cuando los pagos "
        "aprobados cubren su total completo; un pago parcial deja saldo."
    ),
    "vencimientos": (
        "Cada factura tiene una fecha de vencimiento (la regla de facturación define el día del "
        "mes). Está vencida cuando le queda saldo y esa fecha ya pasó. Si la familia tiene una "
        "excepción de vencimiento vigente en el mismo mes, el vencimiento efectivo es la fecha "
        "excepcional más tardía y la factura pasa a vencida recién al día siguiente. Cuando una "
        "factura impaga entra en un tramo de mora nuevo, el sistema emite el evento "
        "factura.vencida, que usan las reglas de workflows para avisar a la familia."
    ),
    "recargos": (
        "Los recargos por mora se configuran en la pantalla Penalidades por mora, como tramos de "
        "días de atraso con un porcentaje. La precarga confirmada es 0 a 5 días: sin recargo, 6 "
        "a 15 días: 20 %, 16 a 30 días: 30 %. Dos tramos activos no pueden superponerse. Los "
        "tramos no se suman: con 16 a 30 días de atraso el recargo total es el 30 % del monto de "
        "la factura, no 20 % más 30 %. El cálculo resta lo ya registrado, así que repetirlo no "
        "duplica el recargo. Los días de atraso se cuentan desde el vencimiento efectivo, y el "
        "recargo se imputa al concepto que tenga configurado el tramo. Para ver los tramos "
        "vigentes usá configuracion_facturacion con la sección penalidades."
    ),
    "excepciones_de_vencimiento": (
        "Una excepción de vencimiento es una fecha excepcional que ESSERI autoriza de antemano "
        "para una familia. Corre el vencimiento de sus facturas de ese mes: se toma la mayor "
        "entre el vencimiento original y las fechas excepcionales del mismo mes. No se edita ni "
        "se borra: se anula y deja de postergar el vencimiento. Se cargan desde la pantalla "
        "Deuda por familia."
    ),
    "generacion_automatica": (
        "Las facturas se generan a partir de reglas de facturación: concepto, importe, "
        "periodicidad (mensual o anual), alcance (todas las inscripciones, un nivel, un año o "
        "una división) y día de vencimiento. Una regla activa en modo automático genera sola en "
        "su día de generación; en modo manual se corre a mano desde la pantalla de reglas. Cada "
        "corrida queda registrada como ejecución (exitosa, parcial o fallida) con sus cantidades "
        "y el monto. Si un período ya se facturó, los cargos repetidos se omiten y no se "
        "duplican facturas. Para ver las reglas y las últimas corridas usá "
        "configuracion_facturacion."
    ),
    "debitos": (
        "Los débitos automáticos de esta versión son una simulación de demostración: no hay "
        "conexión con ningún banco. Administración arma un lote con las facturas impagas de un "
        "período (solo CBU) y descarga el archivo de solicitud, que reserva esas facturas. El "
        "archivo de respuesta (el que haría el banco) se importa, se revisa sin registrar "
        "nada y recién al confirmar se crean los pagos de los débitos cobrados; los rechazados "
        "no generan pago y liberan la reserva de la factura. Cada rechazo trae un motivo, por "
        "ejemplo saldo insuficiente, CBU no encontrado, cuenta inhabilitada o cerrada. Un lote "
        "puede liberarse con un motivo si no se llegó a importar su respuesta. Reimportar el "
        "mismo archivo no duplica pagos. Los resultados se avisan a la familia por mail y en "
        "el Portal Familia. Para cifras reales usá resumen_debitos, lotes_debito o "
        "facturas_para_debitar."
    ),
    "responsable_economico": (
        "Cada alumno tiene un responsable económico, a cuyo nombre se emite la facturación. "
        "Queda fijo hasta que la familia pida un cambio; los cambios se informan antes del día "
        "10 y rigen desde el período siguiente. Se guarda con vigencia desde y hasta, así que la "
        "factura conserva quién era responsable cuando se emitió. Designar un responsable "
        "económico no libera a los demás responsables parentales de sus obligaciones. Quién "
        "recibe los avisos es otra cosa: lo define el campo recibe comunicaciones de cada "
        "vínculo familiar."
    ),
    "portal_familia": (
        "En el Portal Familia, el responsable económico ve sus facturas, los pagos registrados "
        "y el saldo, además de los avisos de resultado de débito (confirmado o rechazado, con "
        "el motivo). Solo ve lo de las facturas de las que es responsable económico en ese "
        "momento. Un pago o un débito cobrado actualiza factura y saldo apenas se registra."
    ),
}


class ParametrosAyuda(BaseModel):
    tema: Tema = Field(description="Tema de facturación a explicar.")


def _ayuda_facturacion(
    contexto: ContextoHerramienta, parametros: ParametrosAyuda
) -> ResultadoHerramienta:
    return ResultadoHerramienta(
        para_llm={
            "tema": parametros.tema,
            "explicacion": AYUDA[parametros.tema],
            "fuente": "Documentación funcional de Facturación",
        }
    )


HERRAMIENTAS = [
    Herramienta(
        nombre="configuracion_facturacion",
        descripcion=(
            "Configuración vigente de facturación según la sección: reglas (concepto, importe, "
            "periodicidad, alcance, estado y próxima generación), ejecuciones (últimas corridas "
            "de facturación y sus fallas), penalidades (tramos de recargo por días de atraso), "
            "conceptos de cobro y metodos_pago. Para '¿cuándo corre la próxima facturación?' o "
            "'¿qué recargo se aplica a los 10 días?'. Si la persona pregunta cómo funciona algo, "
            "combinala con ayuda_facturacion."
        ),
        parametros=ParametrosConfiguracion,
        permisos=(PERMISO_FACTURACION_LEER,),
        ejecutar=_configuracion_facturacion,
    ),
    Herramienta(
        nombre="ayuda_facturacion",
        descripcion=(
            "Explica cómo funciona la facturación en ESSERI, con texto fijo por tema: cuenta "
            "corriente y deuda, vencimientos, recargos, excepciones de vencimiento, generación "
            "automática, débitos, responsable económico y Portal Familia. Usala siempre para "
            "preguntas de 'cómo se calcula' o 'cómo funciona' en lugar de explicar de memoria. "
            "No trae datos reales: si piden valores (porcentajes, fechas, importes) sumá "
            "configuracion_facturacion."
        ),
        parametros=ParametrosAyuda,
        permisos=(PERMISO_FACTURACION_LEER,),
        ejecutar=_ayuda_facturacion,
    ),
]
