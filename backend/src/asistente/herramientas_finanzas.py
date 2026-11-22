"""Deuda por familia, desde la fuente contable."""

import calendar
import uuid
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

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
    fecha_ar,
    mes_iso_ar,
    numero,
    variacion_porcentual,
)
from src.asistente.seudonimos_service import obtener_o_crear_alias, resolver_alias
from src.auth.constants import (
    PERMISO_FACTURACION_CREAR,
    PERMISO_FACTURACION_LEER,
    PERMISO_FAMILIAS_ALUMNOS_LEER,
)
from src.facturacion import formato_cobranza_simulada as formato
from src.facturacion.cuenta_corriente_service import (
    FacturaConSaldo,
    listar_deuda_por_familia,
    listar_facturas_con_saldo,
)
from src.facturacion.facturas_service import PagoAprobado, listar_pagos_aprobados
from src.facturacion.models import (
    ConceptoCobro,
    DebitoCobranza,
    Factura,
    FacturaCobranzaDemo,
    LoteCobranza,
    Pago,
    ResponsableEconomico,
)
from src.facturacion.penalidades_service import listar_excepciones_familia, recargos_de_factura
from src.facturacion.vencimientos_service import fecha_vencimiento_efectiva
from src.familias_alumnos.models import Familia
from src.search import normalizar_texto_busqueda

_FUENTE = "Cuenta corriente (movimientos contables)"
_MAX_FAMILIAS_PARA_TOTAL = 2000


class ParametrosDeudaPorFamilias(BaseModel):
    limite: int = Field(
        default=10, ge=1, le=100, description="Cuántas familias devolver, las de mayor deuda."
    )
    estado: Literal["vencida", "pendiente", "pagada"] | None = Field(
        default=None, description="Filtra por estado de la deuda de la familia."
    )
    al: date | None = Field(
        default=None,
        description="Deuda al cierre de este día, AAAA-MM-DD. Si falta, la deuda de hoy.",
    )
    comparar_al: date | None = Field(
        default=None,
        description="Compara el total vencido con el de esta fecha pasada, AAAA-MM-DD.",
    )
    comparar_con_anterior: bool = Field(
        default=False,
        description="Compara el total vencido con el de un mes antes del corte.",
    )
    grafico: FormaGrafico | None = Field(
        default=None,
        description="Verlo como gráfico: para comparar 3 o más categorías o ver una evolución.",
    )


def _un_mes_antes(dia: date) -> date:
    anio, mes = (dia.year - 1, 12) if dia.month == 1 else (dia.year, dia.month - 1)
    return date(anio, mes, min(dia.day, calendar.monthrange(anio, mes)[1]))


def _total_vencido(
    contexto: ContextoHerramienta, corte: date, al: date | None
) -> tuple[int, float]:
    """Cantidad de familias con deuda vencida y el total vencido de todas ellas."""
    _, cantidad = listar_deuda_por_familia(
        contexto.db, fecha_referencia=corte, pagina=1, tamanio=1, estado="vencida", al=al
    )
    vencidas, _ = listar_deuda_por_familia(
        contexto.db,
        fecha_referencia=corte,
        pagina=1,
        tamanio=max(1, min(cantidad, _MAX_FAMILIAS_PARA_TOTAL)),
        estado="vencida",
        al=al,
    )
    return cantidad, sum(item["monto_vencido"] for item in vencidas)


def _deuda_por_familias(
    contexto: ContextoHerramienta, parametros: ParametrosDeudaPorFamilias
) -> ResultadoHerramienta:
    limite = min(parametros.limite, contexto.max_filas)
    corte = parametros.al or contexto.hoy
    if corte > contexto.hoy:
        return ResultadoHerramienta(para_llm={"error": "La fecha de corte no puede ser futura."})
    comparar_al = parametros.comparar_al
    if comparar_al is None and parametros.comparar_con_anterior:
        comparar_al = _un_mes_antes(corte)
    if comparar_al is not None and comparar_al >= corte:
        return ResultadoHerramienta(
            para_llm={"error": "La fecha a comparar debe ser anterior a la de corte."}
        )
    # Con una fecha pasada, la deuda se reconstruye con lo registrado hasta ese día.
    al = parametros.al
    items, total = listar_deuda_por_familia(
        contexto.db,
        fecha_referencia=corte,
        pagina=1,
        tamanio=limite,
        estado=parametros.estado,
        al=al,
    )
    # Orden de la fuente: primero el monto vencido y después la deuda total.
    filas = [
        {
            "familia": obtener_o_crear_alias(
                contexto.db, contexto.conversacion_id, TIPO_ALIAS_FAMILIA, item["familia_id"]
            ),
            "monto_vencido": numero(item["monto_vencido"]),
            "monto_pendiente": numero(item["monto_pendiente"]),
            "deuda_total": numero(item["deuda_total"]),
            "facturas_pendientes": int(item["facturas_pendientes"]),
        }
        for item in items
    ]
    # Cantidad real de familias por estado de deuda y total vencido de todas: la tabla (las de
    # mayor deuda) no los da y son las cifras que suelen pedirse.
    con_deuda_vencida, vencido = _total_vencido(contexto, corte, al)
    total_vencido = numero(vencido)
    periodo = f"al {fecha_ar(corte)}"
    tabla = bloque_tabla(
        "Deuda por familia",
        [
            {"clave": "familia", "etiqueta": "Familia", "tipo": "alias"},
            {"clave": "monto_vencido", "etiqueta": "Vencido", "tipo": "moneda"},
            {"clave": "monto_pendiente", "etiqueta": "Por vencer", "tipo": "moneda"},
            {"clave": "deuda_total", "etiqueta": "Deuda total", "tipo": "moneda"},
            {"clave": "facturas_pendientes", "etiqueta": "Facturas pendientes", "tipo": "numero"},
        ],
        filas,
        periodo=periodo,
        fuente=_FUENTE,
    )
    para_comparacion: dict[str, object] = {}
    bloques: list[dict[str, Any]] = []
    agregar_tabla(bloques, tabla)
    agregar_grafico(bloques, tabla, parametros.grafico, eje_x="familia", series=["deuda_total"])
    if comparar_al is not None:
        previa = comparar_al
        _, vencido_previo = _total_vencido(contexto, previa, previa)
        variacion = variacion_porcentual(vencido, vencido_previo)
        periodo_previo = f"al {fecha_ar(previa)}"
        para_comparacion = {
            "total_vencido_comparado": numero(vencido_previo),
            "periodo_comparado": periodo_previo,
            "variacion_porcentual": variacion,
        }
        bloques.insert(
            0,
            bloque_kpi(
                "Deuda vencida total",
                total_vencido,
                periodo=periodo,
                fuente=_FUENTE,
                unidad="$",
                variacion=variacion,
                periodo_comparado=periodo_previo,
                mejora="baja",
                valor_anterior=numero(vencido_previo),
            ),
        )
    return ResultadoHerramienta(
        para_llm={
            **para_comparacion,
            "periodo": periodo,
            "fuente": _FUENTE,
            "alcance": "deuda acumulada al corte; no se puede filtrar por mes de la cuota",
            "familias_con_deuda_vencida": con_deuda_vencida,
            "total_vencido_todas_las_familias": total_vencido,
            "familias_con_el_filtro": total,
            "familias_devueltas": len(filas),
            "familias": filas,
        },
        bloques=bloques,
    )


_ESTADOS_FACTURA = Literal["vencida", "pendiente", "pagada"]
_MAX_FACTURAS_ANALISIS = 20000


def _alias_de(contexto: ContextoHerramienta, tipo: str, entidad_id: uuid.UUID) -> str:
    return obtener_o_crear_alias(contexto.db, contexto.conversacion_id, tipo, entidad_id)


def _entidad_de_alias(
    contexto: ContextoHerramienta, alias: str, tipo: str, etiqueta: str
) -> uuid.UUID | str:
    """El id de la entidad, o el mensaje de error si el alias no es del tipo esperado."""
    fila = resolver_alias(contexto.db, contexto.conversacion_id, alias)
    if fila.tipo != tipo:
        return f"El alias no es de {etiqueta}."
    return fila.entidad_id


def _concepto_por_nombre(db: Session, nombre: str) -> ConceptoCobro | None:
    termino = normalizar_texto_busqueda(nombre.strip())
    conceptos = db.scalars(select(ConceptoCobro).order_by(ConceptoCobro.nombre)).all()
    exacto = [c for c in conceptos if normalizar_texto_busqueda(c.nombre) == termino]
    parcial = [c for c in conceptos if termino in normalizar_texto_busqueda(c.nombre)]
    candidatos = exacto or parcial
    return candidatos[0] if candidatos else None


def _nombres_de_conceptos(db: Session) -> list[str]:
    return list(db.scalars(select(ConceptoCobro.nombre).order_by(ConceptoCobro.nombre)))


def _etiqueta_concepto(conceptos: tuple[str, ...]) -> str:
    if not conceptos:
        return "Sin concepto"
    return conceptos[0] if len(conceptos) == 1 else "Varios conceptos"


# --- estado_de_cuenta_familia -------------------------------------------------------------


class ParametrosEstadoDeCuentaFamilia(BaseModel):
    familia: str = Field(description="Alias de la familia, por ejemplo [FAMILIA:2].")


def _ultimo_pago(db: Session, familia_id: uuid.UUID) -> tuple[date, Decimal] | None:
    fila = db.execute(
        select(Pago.fecha, Pago.monto)
        .join(Factura, Factura.id == Pago.factura_id)
        .join(ResponsableEconomico, ResponsableEconomico.id == Factura.responsable_economico_id)
        .where(ResponsableEconomico.familia_id == familia_id, Pago.estado == "aprobado")
        .order_by(Pago.fecha.desc(), Pago.id)
        .limit(1)
    ).first()
    return None if fila is None else (fila[0], Decimal(fila[1]))


def _datos_de_debito(db: Session, factura_ids: list[uuid.UUID]) -> dict[str, object]:
    """Medio de débito de las facturas de la familia y el resultado del último débito."""
    if not factura_ids:
        return {"medios_de_debito": [], "ultimo_debito": None}
    medios = sorted(
        set(
            db.scalars(
                select(FacturaCobranzaDemo.medio).where(
                    FacturaCobranzaDemo.factura_id.in_(factura_ids)
                )
            )
        )
    )
    ultimo = db.execute(
        select(LoteCobranza.periodo, LoteCobranza.fecha, DebitoCobranza.resultado)
        .join(LoteCobranza, LoteCobranza.id == DebitoCobranza.lote_id)
        .where(DebitoCobranza.factura_id.in_(factura_ids))
        .order_by(LoteCobranza.fecha.desc(), DebitoCobranza.id)
        .limit(1)
    ).first()
    resultado = None
    if ultimo is not None:
        periodo, fecha, estado = ultimo
        resultado = {
            "periodo": periodo or f"{fecha:%Y-%m}",
            "resultado": {formato.COBRADO: "cobrado", formato.RECHAZADO: "rechazado"}.get(
                estado, "sin respuesta"
            ),
        }
    return {"medios_de_debito": medios, "ultimo_debito": resultado}


def _estado_de_cuenta_familia(
    contexto: ContextoHerramienta, parametros: ParametrosEstadoDeCuentaFamilia
) -> ResultadoHerramienta:
    entidad = _entidad_de_alias(contexto, parametros.familia, TIPO_ALIAS_FAMILIA, "una familia")
    if isinstance(entidad, str):
        return ResultadoHerramienta(para_llm={"error": entidad})
    familia = contexto.db.get(Familia, entidad)
    if familia is None:
        return ResultadoHerramienta(para_llm={"error": "La familia ya no existe."})

    items, _ = listar_deuda_por_familia(
        contexto.db, fecha_referencia=contexto.hoy, pagina=1, tamanio=1, familia_id=entidad
    )
    deuda = items[0] if items else None
    impagas = [
        f
        for f in listar_facturas_con_saldo(
            contexto.db, fecha_referencia=contexto.hoy, familia_id=entidad
        )
        if f.saldo > 0
    ]
    excepciones = [e for e in listar_excepciones_familia(contexto.db, entidad) if not e.anulada_at]

    filas: list[dict[str, Any]] = []
    total_recargos = Decimal("0.00")
    for factura_fila in impagas[: contexto.max_filas]:
        factura = contexto.db.get(Factura, factura_fila.factura_id)
        recargos = sum(
            (m.monto for m in recargos_de_factura(contexto.db, factura_fila.factura_id)),
            Decimal("0.00"),
        )
        total_recargos += recargos
        efectivo = (
            fecha_vencimiento_efectiva(factura, excepciones)
            if factura is not None
            else factura_fila.fecha_vencimiento
        )
        filas.append(
            {
                "alumno": _alias_de(contexto, TIPO_ALIAS_ALUMNO, factura_fila.alumno_id),
                "concepto": _etiqueta_concepto(factura_fila.conceptos),
                "vencimiento": fecha_ar(efectivo),
                "estado": factura_fila.estado,
                "saldo": numero(factura_fila.saldo),
                "recargos": numero(recargos),
            }
        )

    ultimo_pago = _ultimo_pago(contexto.db, entidad)
    periodo = f"al {fecha_ar(contexto.hoy)}"
    para_llm: dict[str, Any] = {
        "familia": parametros.familia,
        "periodo": periodo,
        "fuente": _FUENTE,
        "deuda_vencida": numero(deuda["monto_vencido"]) if deuda else 0,
        "deuda_por_vencer": numero(deuda["monto_pendiente"]) if deuda else 0,
        "deuda_total": numero(deuda["deuda_total"]) if deuda else 0,
        "facturas_impagas": len(impagas),
        "facturas_devueltas": len(filas),
        "recargos_aplicados_en_las_devueltas": numero(total_recargos),
        "facturas": filas,
        "ultimo_pago": (
            None
            if ultimo_pago is None
            else {"fecha": fecha_ar(ultimo_pago[0]), "monto": numero(ultimo_pago[1])}
        ),
        # El motivo de la excepción es texto libre y no sale.
        "excepciones_de_vencimiento_vigentes": [
            {"nueva_fecha": fecha_ar(e.fecha_vencimiento_excepcional)} for e in excepciones
        ],
        "nota": "El vencimiento de cada factura ya incluye las excepciones vigentes.",
    }
    if contexto.tiene_permiso(PERMISO_FACTURACION_CREAR):
        todas = listar_facturas_con_saldo(
            contexto.db, fecha_referencia=contexto.hoy, familia_id=entidad
        )
        para_llm.update(_datos_de_debito(contexto.db, [f.factura_id for f in todas]))
    tabla = bloque_tabla(
        "Facturas impagas de la familia",
        [
            {"clave": "alumno", "etiqueta": "Alumno", "tipo": "alias"},
            {"clave": "concepto", "etiqueta": "Concepto", "tipo": "texto"},
            {"clave": "vencimiento", "etiqueta": "Vencimiento", "tipo": "texto"},
            {"clave": "estado", "etiqueta": "Estado", "tipo": "texto"},
            {"clave": "saldo", "etiqueta": "Saldo", "tipo": "moneda"},
            {"clave": "recargos", "etiqueta": "Recargos", "tipo": "moneda"},
        ],
        filas,
        periodo=periodo,
        fuente=_FUENTE,
    )
    bloques: list[dict[str, Any]] = []
    agregar_tabla(bloques, tabla)
    return ResultadoHerramienta(para_llm=para_llm, bloques=bloques)


# --- facturas -------------------------------------------------------------------------------


class ParametrosFacturas(BaseModel):
    estado: _ESTADOS_FACTURA | None = Field(
        default=None, description="Estado efectivo según el saldo y el vencimiento."
    )
    concepto: str | None = Field(
        default=None, description="Nombre (o parte) del concepto, por ejemplo Cuota o Matrícula."
    )
    emision_desde: date | None = Field(default=None, description="AAAA-MM-DD.")
    emision_hasta: date | None = Field(default=None, description="AAAA-MM-DD.")
    vencimiento_desde: date | None = Field(default=None, description="AAAA-MM-DD.")
    vencimiento_hasta: date | None = Field(default=None, description="AAAA-MM-DD.")
    alumno: str | None = Field(default=None, description="Alias de un alumno, [ALUMNO:1].")
    familia: str | None = Field(default=None, description="Alias de una familia, [FAMILIA:1].")
    agrupar_por: Literal["concepto", "estado", "mes"] | None = Field(
        default=None,
        description="Agrupa los totales. `mes` es el mes de emisión. Sin esto, lista facturas.",
    )
    limite: int = Field(default=10, ge=1, le=100, description="Filas a devolver sin agrupar.")
    grafico: FormaGrafico | None = Field(
        default=None, description="Verlo como gráfico: solo con agrupar_por."
    )


def _sumar(facturas: list[FacturaConSaldo]) -> dict[str, Any]:
    return {
        "cantidad": len(facturas),
        "monto_facturado": numero(sum((f.monto_total for f in facturas), Decimal("0.00"))),
        "saldo_impago": numero(sum((f.saldo for f in facturas if f.saldo > 0), Decimal("0.00"))),
    }


def _facturas(
    contexto: ContextoHerramienta, parametros: ParametrosFacturas
) -> ResultadoHerramienta:
    alumno_id = familia_id = concepto_id = None
    if parametros.alumno is not None:
        entidad = _entidad_de_alias(contexto, parametros.alumno, TIPO_ALIAS_ALUMNO, "un alumno")
        if isinstance(entidad, str):
            return ResultadoHerramienta(para_llm={"error": entidad})
        alumno_id = entidad
    if parametros.familia is not None:
        entidad = _entidad_de_alias(contexto, parametros.familia, TIPO_ALIAS_FAMILIA, "una familia")
        if isinstance(entidad, str):
            return ResultadoHerramienta(para_llm={"error": entidad})
        familia_id = entidad
    if parametros.concepto is not None:
        concepto = _concepto_por_nombre(contexto.db, parametros.concepto)
        if concepto is None:
            return ResultadoHerramienta(
                para_llm={
                    "error": "No hay un concepto con ese nombre.",
                    "conceptos_disponibles": _nombres_de_conceptos(contexto.db),
                }
            )
        concepto_id = concepto.id
    facturas = listar_facturas_con_saldo(
        contexto.db,
        fecha_referencia=contexto.hoy,
        estado=parametros.estado,
        concepto_cobro_id=concepto_id,
        emision_desde=parametros.emision_desde,
        emision_hasta=parametros.emision_hasta,
        vencimiento_desde=parametros.vencimiento_desde,
        vencimiento_hasta=parametros.vencimiento_hasta,
        alumno_id=alumno_id,
        familia_id=familia_id,
        limite=_MAX_FACTURAS_ANALISIS,
    )
    periodo = f"al {fecha_ar(contexto.hoy)}"
    para_llm: dict[str, Any] = {
        "periodo": periodo,
        "fuente": _FUENTE,
        "criterio": (
            "El estado sale del saldo contable y la fecha de vencimiento original de la factura; "
            "las excepciones de vencimiento no se aplican acá."
        ),
        "totales": _sumar(facturas),
    }
    bloques: list[dict[str, Any]] = []
    if parametros.agrupar_por is not None:
        grupos: dict[str, list[FacturaConSaldo]] = defaultdict(list)
        for f in facturas:
            if parametros.agrupar_por == "concepto":
                clave = _etiqueta_concepto(f.conceptos)
            elif parametros.agrupar_por == "estado":
                clave = f.estado
            else:
                clave = f"{f.fecha_emision:%Y-%m}"
            grupos[clave].append(f)
        filas = [
            {
                parametros.agrupar_por: mes_iso_ar(clave)
                if parametros.agrupar_por == "mes"
                else clave,
                **_sumar(grupo),
            }
            for clave, grupo in sorted(grupos.items())
        ]
        tabla = bloque_tabla(
            "Facturas agrupadas",
            [
                {"clave": parametros.agrupar_por, "etiqueta": "Grupo", "tipo": "texto"},
                {"clave": "cantidad", "etiqueta": "Facturas", "tipo": "numero"},
                {"clave": "monto_facturado", "etiqueta": "Facturado", "tipo": "moneda"},
                {"clave": "saldo_impago", "etiqueta": "Saldo impago", "tipo": "moneda"},
            ],
            filas,
            periodo=periodo,
            fuente=_FUENTE,
        )
        agregar_tabla(bloques, tabla)
        agregar_grafico(
            bloques,
            tabla,
            parametros.grafico,
            eje_x=parametros.agrupar_por,
            series=["monto_facturado"],
        )
        para_llm["agrupado_por"] = parametros.agrupar_por
        para_llm["grupos"] = filas
        return ResultadoHerramienta(para_llm=para_llm, bloques=bloques, destino_sugerido=None)

    limite = min(parametros.limite, contexto.max_filas)
    filas = [
        {
            "alumno": _alias_de(contexto, TIPO_ALIAS_ALUMNO, f.alumno_id),
            "familia": _alias_de(contexto, TIPO_ALIAS_FAMILIA, f.familia_id),
            "concepto": _etiqueta_concepto(f.conceptos),
            "emision": fecha_ar(f.fecha_emision),
            "vencimiento": fecha_ar(f.fecha_vencimiento),
            "estado": f.estado,
            "monto": numero(f.monto_total),
            "saldo": numero(max(f.saldo, Decimal("0.00"))),
        }
        for f in facturas[:limite]
    ]
    tabla = bloque_tabla(
        "Facturas",
        [
            {"clave": "alumno", "etiqueta": "Alumno", "tipo": "alias"},
            {"clave": "familia", "etiqueta": "Familia", "tipo": "alias"},
            {"clave": "concepto", "etiqueta": "Concepto", "tipo": "texto"},
            {"clave": "emision", "etiqueta": "Emisión", "tipo": "texto"},
            {"clave": "vencimiento", "etiqueta": "Vencimiento", "tipo": "texto"},
            {"clave": "estado", "etiqueta": "Estado", "tipo": "texto"},
            {"clave": "monto", "etiqueta": "Monto", "tipo": "moneda"},
            {"clave": "saldo", "etiqueta": "Saldo", "tipo": "moneda"},
        ],
        filas,
        periodo=periodo,
        fuente=_FUENTE,
    )
    agregar_tabla(bloques, tabla)
    para_llm["facturas_devueltas"] = len(filas)
    para_llm["facturas"] = filas
    return ResultadoHerramienta(para_llm=para_llm, bloques=bloques)


# --- resumen_cobros -------------------------------------------------------------------------


class ParametrosResumenCobros(BaseModel):
    desde: date | None = Field(
        default=None, description="Inicio, AAAA-MM-DD. Por defecto, el 1 del mes en curso."
    )
    hasta: date | None = Field(default=None, description="Fin, AAAA-MM-DD. Por defecto, hoy.")
    agrupar_por: Literal["metodo", "mes", "concepto"] = Field(
        default="metodo",
        description="`metodo` separa los débitos automáticos de los pagos manuales.",
    )
    comparar_con_anterior: bool = Field(
        default=False,
        description="Compara el total cobrado con el período anterior de igual duración.",
    )
    grafico: FormaGrafico | None = Field(
        default=None, description="Verlo como gráfico: para 3 o más grupos."
    )


def _grupo_de_pago(pago: PagoAprobado, agrupar_por: str) -> str:
    if agrupar_por == "metodo":
        return pago.metodo
    if agrupar_por == "mes":
        return f"{pago.fecha:%Y-%m}"
    return _etiqueta_concepto(pago.conceptos)


def _resumen_cobros(
    contexto: ContextoHerramienta, parametros: ParametrosResumenCobros
) -> ResultadoHerramienta:
    hasta = parametros.hasta or contexto.hoy
    desde = parametros.desde or date(hasta.year, hasta.month, 1)
    if desde > hasta:
        return ResultadoHerramienta(para_llm={"error": "La fecha inicial es posterior a la final."})
    pagos = listar_pagos_aprobados(contexto.db, desde=desde, hasta=hasta)
    total = sum((p.monto for p in pagos), Decimal("0.00"))
    por_debito = sum((p.monto for p in pagos if p.por_debito), Decimal("0.00"))
    periodo = f"{fecha_ar(desde)} a {fecha_ar(hasta)}"
    fuente = "Pagos aprobados"

    grupos: dict[str, list[PagoAprobado]] = defaultdict(list)
    for pago in pagos:
        grupos[_grupo_de_pago(pago, parametros.agrupar_por)].append(pago)
    filas = [
        {
            "grupo": mes_iso_ar(clave) if parametros.agrupar_por == "mes" else clave,
            "pagos": len(grupo),
            "monto": numero(sum((p.monto for p in grupo), Decimal("0.00"))),
        }
        for clave, grupo in sorted(grupos.items())
    ]
    para_llm: dict[str, Any] = {
        "periodo": periodo,
        "fuente": fuente,
        "criterio": "Pagos aprobados según su fecha de pago. Débito es el cobrado por lotes.",
        "total_cobrado": numero(total),
        "cantidad_de_pagos": len(pagos),
        "cobrado_por_debito": numero(por_debito),
        "cobrado_manual": numero(total - por_debito),
        "agrupado_por": parametros.agrupar_por,
        "grupos": filas,
    }
    bloques: list[dict[str, Any]] = []
    tabla = bloque_tabla(
        "Cobros",
        [
            {"clave": "grupo", "etiqueta": "Grupo", "tipo": "texto"},
            {"clave": "pagos", "etiqueta": "Pagos", "tipo": "numero"},
            {"clave": "monto", "etiqueta": "Cobrado", "tipo": "moneda"},
        ],
        filas,
        periodo=periodo,
        fuente=fuente,
    )
    agregar_tabla(bloques, tabla)
    agregar_grafico(bloques, tabla, parametros.grafico, eje_x="grupo", series=["monto"])
    if parametros.comparar_con_anterior:
        hasta_ant = desde - timedelta(days=1)
        desde_ant = hasta_ant - (hasta - desde)
        previos = listar_pagos_aprobados(contexto.db, desde=desde_ant, hasta=hasta_ant)
        total_previo = sum((p.monto for p in previos), Decimal("0.00"))
        periodo_ant = f"{fecha_ar(desde_ant)} a {fecha_ar(hasta_ant)}"
        variacion = variacion_porcentual(total, total_previo)
        para_llm["comparacion"] = {
            "periodo_anterior": periodo_ant,
            "total_cobrado_anterior": numero(total_previo),
            "variacion_porcentual": variacion,
        }
        bloques.insert(
            0,
            bloque_kpi(
                "Cobrado",
                numero(total),
                periodo=periodo,
                fuente=fuente,
                unidad="$",
                variacion=variacion,
                periodo_comparado=periodo_ant,
                mejora="alza",
                valor_anterior=numero(total_previo) if previos else None,
            ),
        )
    return ResultadoHerramienta(para_llm=para_llm, bloques=bloques)


HERRAMIENTAS = [
    Herramienta(
        nombre="deuda_por_familias",
        descripcion=(
            "Ranking de las familias con mayor deuda (vencida y total) según la cuenta "
            "corriente, hoy o al cierre de cualquier día pasado (parámetro al), con variación "
            "contra otra fecha (comparar_al). Cada familia viene como alias, sin nombre ni DNI. "
            "Para la deuda de UNA familia puntual usá estado_de_cuenta_familia."
        ),
        parametros=ParametrosDeudaPorFamilias,
        permisos=(PERMISO_FACTURACION_LEER,),
        ejecutar=_deuda_por_familias,
        destino="deuda_por_familia",
    ),
    Herramienta(
        nombre="estado_de_cuenta_familia",
        descripcion=(
            "Estado de cuenta de UNA familia (por su alias): deuda vencida y por vencer, "
            "facturas impagas por alumno con su vencimiento efectivo y saldo, recargos "
            "aplicados, último pago y excepciones de vencimiento vigentes. Usala para '¿qué debe "
            "[FAMILIA:2]?'. Para un ranking de familias usá deuda_por_familias; para listar o "
            "contar facturas en general, facturas."
        ),
        parametros=ParametrosEstadoDeCuentaFamilia,
        permisos=(PERMISO_FACTURACION_LEER, PERMISO_FAMILIAS_ALUMNOS_LEER),
        ejecutar=_estado_de_cuenta_familia,
        destino="deuda_por_familia",
    ),
    Herramienta(
        nombre="facturas",
        descripcion=(
            "Cantidad y monto de facturas filtradas por estado (vencida, pendiente, pagada), "
            "concepto, fechas de emisión o vencimiento, alumno o familia (alias). Con agrupar_por "
            "(concepto, estado, mes) devuelve totales por grupo; sin agrupar, las primeras "
            "facturas. Sirve para '¿qué vence esta semana?', '¿cuánto se facturó de matrícula?' "
            "o '¿cuántas facturas de octubre siguen impagas?'. No sirve para cobros (usá "
            "resumen_cobros) ni para la deuda de una familia (estado_de_cuenta_familia)."
        ),
        parametros=ParametrosFacturas,
        permisos=(PERMISO_FACTURACION_LEER,),
        ejecutar=_facturas,
        destino="facturas",
    ),
    Herramienta(
        nombre="resumen_cobros",
        descripcion=(
            "Pagos aprobados en un período: total, cuánto entró por débito automático y cuánto "
            "manual, agrupados por método de pago, mes o concepto, con comparación contra el "
            "período anterior. Para '¿cuánto se cobró en octubre?'. Para facturado contra cobrado "
            "mes a mes usá evolucion_financiera; para el resultado de los débitos (rechazos), "
            "resumen_debitos."
        ),
        parametros=ParametrosResumenCobros,
        permisos=(PERMISO_FACTURACION_LEER,),
        ejecutar=_resumen_cobros,
        destino="facturas",
    ),
]
