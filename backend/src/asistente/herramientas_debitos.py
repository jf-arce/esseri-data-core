"""Débitos automáticos: resultados agregados, lotes y facturas que se pueden debitar."""

import uuid
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field
from sqlalchemy import select

from src.asistente.constants import TIPO_ALIAS_ALUMNO, TIPO_ALIAS_FAMILIA
from src.asistente.herramientas_base import (
    ContextoHerramienta,
    FormaGrafico,
    Herramienta,
    ResultadoHerramienta,
    agregar_grafico,
    agregar_tabla,
    bloque_kpi,
    bloque_tabla,
    mes_iso_ar,
    numero,
    porcentaje,
    variacion_porcentual,
)
from src.asistente.seudonimos_service import obtener_o_crear_alias
from src.auth.constants import PERMISO_FACTURACION_CREAR, PERMISO_FACTURACION_LEER
from src.facturacion import formato_cobranza_simulada as formato
from src.facturacion.cobranzas_schemas import FiltrosSeleccion, Seleccion
from src.facturacion.cobranzas_service import (
    ResumenDebitosPeriodo,
    leer_lote,
    listar_elegibles,
    listar_lotes,
    obtener_lote,
    opciones,
    resumen_debitos_por_periodo,
    resumen_seleccion,
)
from src.facturacion.models import (
    Factura,
    ImportacionCobranza,
    ImportacionCobranzaDetalle,
    ResponsableEconomico,
)
from src.inscripciones.models import Inscripcion

_FUENTE = "Débitos automáticos (lotes y resultados importados)"
_PATRON_PERIODO = r"^\d{4}-(0[1-9]|1[0-2])$"
_DESCRIPCION_MOTIVO = dict(formato.MOTIVOS_RECHAZO_SIMULADOS)


def _periodo_anterior(desde: str, hasta: str) -> tuple[str, str]:
    """Mismo largo en meses, terminando el mes anterior a `desde`."""
    anio_d, mes_d = int(desde[:4]), int(desde[5:])
    anio_h, mes_h = int(hasta[:4]), int(hasta[5:])
    largo = (anio_h - anio_d) * 12 + mes_h - mes_d + 1
    fin = anio_d * 12 + mes_d - 2
    inicio = fin - largo + 1
    return f"{inicio // 12:04d}-{inicio % 12 + 1:02d}", f"{fin // 12:04d}-{fin % 12 + 1:02d}"


# --- resumen_debitos ------------------------------------------------------------------------


class ParametrosResumenDebitos(BaseModel):
    desde: str | None = Field(
        default=None,
        pattern=_PATRON_PERIODO,
        description="Primer mes, AAAA-MM. Por defecto, el mes en curso.",
    )
    hasta: str | None = Field(
        default=None,
        pattern=_PATRON_PERIODO,
        description="Último mes, AAAA-MM. Por defecto, igual a desde.",
    )
    agrupar_por: Literal["mes"] | None = Field(
        default=None, description="`mes` devuelve una fila por mes del rango."
    )
    comparar_con_anterior: bool = Field(
        default=False, description="Compara con el rango anterior de igual cantidad de meses."
    )
    grafico: FormaGrafico | None = Field(
        default=None, description="Verlo como gráfico: solo con agrupar_por mes."
    )


def _totales(filas: list[ResumenDebitosPeriodo]) -> dict[str, Any]:
    enviados = sum(f.enviados for f in filas)
    cobrados = sum(f.cobrados for f in filas)
    rechazados = sum(f.rechazados for f in filas)
    return {
        "lotes": sum(f.lotes for f in filas),
        "debitos_enviados": enviados,
        "cobrados": cobrados,
        "rechazados": rechazados,
        "sin_respuesta": sum(f.sin_respuesta for f in filas),
        "importe_enviado": numero(sum((f.importe_enviado for f in filas), Decimal("0.00"))),
        "importe_cobrado": numero(sum((f.importe_cobrado for f in filas), Decimal("0.00"))),
        "importe_rechazado": numero(sum((f.importe_rechazado for f in filas), Decimal("0.00"))),
        "tasa_de_rechazo_porcentaje": porcentaje(rechazados, cobrados + rechazados),
    }


def _resumen_debitos(
    contexto: ContextoHerramienta, parametros: ParametrosResumenDebitos
) -> ResultadoHerramienta:
    desde = parametros.desde or f"{contexto.hoy:%Y-%m}"
    hasta = parametros.hasta or desde
    if desde > hasta:
        return ResultadoHerramienta(para_llm={"error": "El mes inicial es posterior al final."})
    filas, motivos = resumen_debitos_por_periodo(contexto.db, desde=desde, hasta=hasta)
    periodo = mes_iso_ar(desde) if desde == hasta else f"{mes_iso_ar(desde)} a {mes_iso_ar(hasta)}"
    totales = _totales(filas)
    para_llm: dict[str, Any] = {
        "periodo": periodo,
        "fuente": _FUENTE,
        "criterio": (
            "Tasa de rechazo = rechazados sobre los débitos con respuesta (cobrados + rechazados). "
            "Sin respuesta son los que todavía no tienen el archivo de resultados importado."
        ),
        **totales,
        "motivos_de_rechazo": [
            {"motivo": _DESCRIPCION_MOTIVO.get(codigo, codigo), "cantidad": cantidad}
            for codigo, cantidad in sorted(motivos.items(), key=lambda par: (-par[1], par[0]))
        ],
    }
    bloques: list[dict[str, Any]] = []
    if parametros.agrupar_por == "mes":
        por_mes = [
            {
                "mes": mes_iso_ar(f.periodo),
                "enviados": f.enviados,
                "cobrados": f.cobrados,
                "rechazados": f.rechazados,
                "sin_respuesta": f.sin_respuesta,
                "importe_cobrado": numero(f.importe_cobrado),
                "tasa_de_rechazo": porcentaje(f.rechazados, f.cobrados + f.rechazados),
            }
            for f in filas
        ]
        tabla = bloque_tabla(
            "Débitos por mes",
            [
                {"clave": "mes", "etiqueta": "Mes", "tipo": "texto"},
                {"clave": "enviados", "etiqueta": "Enviados", "tipo": "numero"},
                {"clave": "cobrados", "etiqueta": "Cobrados", "tipo": "numero"},
                {"clave": "rechazados", "etiqueta": "Rechazados", "tipo": "numero"},
                {"clave": "sin_respuesta", "etiqueta": "Sin respuesta", "tipo": "numero"},
                {"clave": "importe_cobrado", "etiqueta": "Cobrado", "tipo": "moneda"},
                {"clave": "tasa_de_rechazo", "etiqueta": "Rechazo", "tipo": "porcentaje"},
            ],
            por_mes,
            periodo=periodo,
            fuente=_FUENTE,
        )
        agregar_tabla(bloques, tabla)
        agregar_grafico(
            bloques, tabla, parametros.grafico, eje_x="mes", series=["cobrados", "rechazados"]
        )
        para_llm["meses"] = por_mes
    if parametros.comparar_con_anterior:
        desde_ant, hasta_ant = _periodo_anterior(desde, hasta)
        previas, _ = resumen_debitos_por_periodo(contexto.db, desde=desde_ant, hasta=hasta_ant)
        previo = _totales(previas)
        periodo_ant = (
            mes_iso_ar(desde_ant)
            if desde_ant == hasta_ant
            else f"{mes_iso_ar(desde_ant)} a {mes_iso_ar(hasta_ant)}"
        )
        variacion = variacion_porcentual(totales["importe_cobrado"], previo["importe_cobrado"])
        para_llm["comparacion"] = {
            "periodo_anterior": periodo_ant,
            "importe_cobrado_anterior": previo["importe_cobrado"],
            "variacion_importe_cobrado_porcentual": variacion,
            "rechazados_anterior": previo["rechazados"],
            "tasa_de_rechazo_anterior_porcentaje": previo["tasa_de_rechazo_porcentaje"],
        }
        bloques.insert(
            0,
            bloque_kpi(
                "Cobrado por débito",
                totales["importe_cobrado"],
                periodo=periodo,
                fuente=_FUENTE,
                unidad="$",
                variacion=variacion,
                periodo_comparado=periodo_ant,
                mejora="alza",
                valor_anterior=previo["importe_cobrado"] if previas else None,
            ),
        )
    return ResultadoHerramienta(para_llm=para_llm, bloques=bloques)


# --- lotes_debito ---------------------------------------------------------------------------


class ParametrosLotesDebito(BaseModel):
    codigo: str | None = Field(
        default=None, max_length=20, description="Código de un lote (LD-...) para ver su detalle."
    )
    periodo: str | None = Field(default=None, pattern=_PATRON_PERIODO, description="AAAA-MM.")
    estado: Literal["exportado", "en_revision", "pagos_registrados", "liberado"] | None = None
    limite: int = Field(default=10, ge=1, le=50, description="Lotes a devolver.")


def _estado_importacion(contexto: ContextoHerramienta, importacion_id: uuid.UUID | None) -> str:
    if importacion_id is None:
        return "sin importar"
    importacion = contexto.db.get(ImportacionCobranza, importacion_id)
    return "sin importar" if importacion is None else importacion.estado


def _detalle_de_lote(contexto: ContextoHerramienta, codigo: str) -> ResultadoHerramienta:
    historial = listar_lotes(
        contexto.db, periodo=None, estado=None, buscar=codigo, pagina=1, tamanio=10
    )
    encontrado = next((x for x in historial.items if x.codigo.lower() == codigo.lower()), None)
    if encontrado is None:
        return ResultadoHerramienta(para_llm={"error": "No hay un lote con ese código."})
    detalle = leer_lote(contexto.db, obtener_lote(contexto.db, encontrado.id))
    rechazados = [d for d in detalle.items if d.resultado == formato.RECHAZADO]
    factura_ids = [d.factura_id for d in rechazados]
    personas = {
        factura_id: (alumno_id, familia_id)
        for factura_id, alumno_id, familia_id in contexto.db.execute(
            select(Factura.id, Inscripcion.alumno_id, ResponsableEconomico.familia_id)
            .join(Inscripcion, Inscripcion.id == Factura.inscripcion_id)
            .join(ResponsableEconomico, ResponsableEconomico.id == Factura.responsable_economico_id)
            .where(Factura.id.in_(factura_ids))
        )
    }
    motivos = {
        debito_id: codigo_motivo
        for debito_id, codigo_motivo in contexto.db.execute(
            select(ImportacionCobranzaDetalle.debito_id, ImportacionCobranzaDetalle.codigo)
            .join(
                ImportacionCobranza,
                ImportacionCobranza.id == ImportacionCobranzaDetalle.importacion_id,
            )
            .where(
                ImportacionCobranza.lote_id == encontrado.id,
                ImportacionCobranza.estado == "confirmada",
                ImportacionCobranzaDetalle.resultado == formato.RECHAZADO,
            )
        )
    }
    ya_cobrados = sum(1 for d in detalle.items if d.resultado == formato.COBRADO)
    filas = []
    for debito in rechazados[: contexto.max_filas]:
        alumno_id, familia_id = personas.get(debito.factura_id, (None, None))
        codigo_motivo = motivos.get(debito.referencia)
        filas.append(
            {
                "alumno": obtener_o_crear_alias(
                    contexto.db, contexto.conversacion_id, TIPO_ALIAS_ALUMNO, alumno_id
                )
                if alumno_id
                else None,
                "familia": obtener_o_crear_alias(
                    contexto.db, contexto.conversacion_id, TIPO_ALIAS_FAMILIA, familia_id
                )
                if familia_id
                else None,
                "importe": numero(debito.importe),
                "motivo": _DESCRIPCION_MOTIVO.get(codigo_motivo or "", "Sin motivo informado"),
            }
        )
    periodo = mes_iso_ar(detalle.periodo)
    tabla = bloque_tabla(
        f"Débitos rechazados del lote {detalle.codigo}",
        [
            {"clave": "alumno", "etiqueta": "Alumno", "tipo": "alias"},
            {"clave": "familia", "etiqueta": "Familia", "tipo": "alias"},
            {"clave": "importe", "etiqueta": "Importe", "tipo": "moneda"},
            {"clave": "motivo", "etiqueta": "Motivo", "tipo": "texto"},
        ],
        filas,
        periodo=periodo,
        fuente=_FUENTE,
    )
    bloques: list[dict[str, Any]] = []
    agregar_tabla(bloques, tabla)
    return ResultadoHerramienta(
        para_llm={
            "lote": detalle.codigo,
            "periodo": periodo,
            "fuente": _FUENTE,
            "estado": detalle.estado,
            "estado_de_la_importacion": _estado_importacion(contexto, detalle.importacion_id),
            "debitos": len(detalle.items),
            "importe_total": numero(detalle.importe_total),
            "cobrados": ya_cobrados,
            "rechazados": len(rechazados),
            "rechazados_devueltos": len(filas),
            "detalle_rechazados": filas,
        },
        bloques=bloques,
    )


def _lotes_debito(
    contexto: ContextoHerramienta, parametros: ParametrosLotesDebito
) -> ResultadoHerramienta:
    if parametros.codigo is not None:
        return _detalle_de_lote(contexto, parametros.codigo)
    historial = listar_lotes(
        contexto.db,
        periodo=parametros.periodo,
        estado=parametros.estado,
        buscar=None,
        pagina=1,
        tamanio=min(parametros.limite, contexto.max_filas),
    )
    filas = [
        {
            "codigo": lote.codigo,
            "periodo": mes_iso_ar(lote.periodo),
            "estado": lote.estado,
            "debitos": lote.cantidad_facturas,
            "importe": numero(lote.importe_total),
            "importacion": _estado_importacion(contexto, lote.importacion_id),
        }
        for lote in historial.items
    ]
    tabla = bloque_tabla(
        "Lotes de débito",
        [
            {"clave": "codigo", "etiqueta": "Lote", "tipo": "texto"},
            {"clave": "periodo", "etiqueta": "Período", "tipo": "texto"},
            {"clave": "estado", "etiqueta": "Estado", "tipo": "texto"},
            {"clave": "debitos", "etiqueta": "Débitos", "tipo": "numero"},
            {"clave": "importe", "etiqueta": "Importe", "tipo": "moneda"},
            {"clave": "importacion", "etiqueta": "Importación", "tipo": "texto"},
        ],
        filas,
        periodo="todos los períodos"
        if parametros.periodo is None
        else mes_iso_ar(parametros.periodo),
        fuente=_FUENTE,
    )
    bloques: list[dict[str, Any]] = []
    agregar_tabla(bloques, tabla)
    return ResultadoHerramienta(
        para_llm={
            "fuente": _FUENTE,
            "lotes_con_el_filtro": historial.total,
            "lotes_devueltos": len(filas),
            "lotes": filas,
        },
        bloques=bloques,
    )


# --- facturas_para_debitar ------------------------------------------------------------------


class ParametrosFacturasParaDebitar(BaseModel):
    periodo: str | None = Field(default=None, pattern=_PATRON_PERIODO, description="AAAA-MM.")
    medio: Literal["cbu", "tarjeta"] | None = None


def _facturas_para_debitar(
    contexto: ContextoHerramienta, parametros: ParametrosFacturasParaDebitar
) -> ResultadoHerramienta:
    filtros = FiltrosSeleccion(periodo=parametros.periodo, medio=parametros.medio)
    elegibles = listar_elegibles(contexto.db, filtros=filtros, pagina=1, tamanio=1)
    resumen = resumen_seleccion(contexto.db, Seleccion(modo="filtrados", filtros=filtros))
    por_medio = {
        medio: {"cantidad": datos.cantidad, "importe": numero(datos.importe)}
        for medio, datos in resumen.por_medio.items()
    }
    return ResultadoHerramienta(
        para_llm={
            "fuente": _FUENTE,
            "criterio": "Facturas impagas que todavía no están reservadas por otro lote.",
            "facturas_que_se_pueden_debitar": resumen.cantidad,
            "importe_total": numero(resumen.importe_total),
            "por_medio": por_medio,
            "ocultas_por_estar_en_otro_lote": elegibles.ocultas_en_lote,
            "periodos_disponibles": opciones(contexto.db)["periodos"],
        },
    )


HERRAMIENTAS = [
    Herramienta(
        nombre="resumen_debitos",
        descripcion=(
            "Resultado de los débitos automáticos de un mes o rango (AAAA-MM): lotes, débitos "
            "enviados, cobrados, rechazados y sin respuesta, importes, tasa de rechazo y motivos "
            "de rechazo con su cantidad. Con agrupar_por mes, una fila por mes. Para '¿cuántos "
            "débitos rebotaron y por qué?' o '¿cuánto se cobró por débito?'. Es agregado: no "
            "lista lotes ni familias (para eso, lotes_debito). Para cobros en general usá "
            "resumen_cobros."
        ),
        parametros=ParametrosResumenDebitos,
        permisos=(PERMISO_FACTURACION_LEER,),
        ejecutar=_resumen_debitos,
    ),
    Herramienta(
        nombre="lotes_debito",
        descripcion=(
            "Historial de lotes de débito (código, período, estado, cantidades, importes e "
            "importación). Con codigo devuelve el detalle de ese lote: los débitos rechazados por "
            "familia y alumno (alias) con su motivo. Para totales y tasas por mes usá "
            "resumen_debitos."
        ),
        parametros=ParametrosLotesDebito,
        permisos=(PERMISO_FACTURACION_CREAR,),
        ejecutar=_lotes_debito,
        destino="cobranzas",
    ),
    Herramienta(
        nombre="facturas_para_debitar",
        descripcion=(
            "Cuántas facturas se pueden debitar hoy y por qué monto (por medio: cbu o tarjeta), "
            "y cuántas quedan fuera por estar en otro lote. Filtros opcionales: periodo y medio. "
            "Para armar un lote o saber qué falta debitar."
        ),
        parametros=ParametrosFacturasParaDebitar,
        permisos=(PERMISO_FACTURACION_CREAR,),
        ejecutar=_facturas_para_debitar,
        destino="cobranzas",
    ),
]
