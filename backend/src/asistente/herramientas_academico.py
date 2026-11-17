"""Inscripciones, asistencias y ficha de alumno."""

from datetime import date, timedelta
from typing import Literal

from pydantic import BaseModel, Field
from sqlalchemy import func, select

from src.academico.models import Anio, Division, NivelEducativo
from src.asistente.constants import MAX_DIAS_PERIODO, TIPO_ALIAS_ALUMNO, TIPOS_AUSENTE
from src.asistente.herramientas_base import (
    ContextoHerramienta,
    FormaGrafico,
    Herramienta,
    ResultadoHerramienta,
    agregar_grafico,
    agregar_tabla,
    bloque_kpi,
    bloque_tabla,
    bloque_tarjeta,
    fecha_ar,
    mes_ar,
    numero,
    porcentaje,
    variacion_porcentual,
)
from src.asistente.seudonimos_service import obtener_o_crear_alias, resolver_alias
from src.auth.constants import (
    PERMISO_ACADEMICO_LEER,
    PERMISO_FACTURACION_LEER,
    PERMISO_FAMILIAS_ALUMNOS_LEER,
    PERMISO_INSCRIPCIONES_LEER,
)
from src.facturacion.cuenta_corriente_service import obtener_resumen_cuenta
from src.familias_alumnos.models import Alumno
from src.inscripciones.models import Asistencia, Inscripcion, SolicitudInscripcion

_MAX_DIAS_POR_DIA = 62


class ParametrosCiclo(BaseModel):
    ciclo_lectivo: str | None = Field(
        default=None, description="Año del ciclo lectivo. Si falta, el seleccionado en pantalla."
    )
    comparar_con_anterior: bool = Field(
        default=False,
        description="Suma las inscripciones del ciclo lectivo anterior y la variación.",
    )
    grafico: FormaGrafico | None = Field(
        default=None, description="Solo si conviene verlo en un gráfico o lo piden."
    )


def _inscripciones_por_tipo_estado(contexto: ContextoHerramienta, ciclo: str) -> dict:
    filas = contexto.db.execute(
        select(Inscripcion.tipo, Inscripcion.estado, func.count(Inscripcion.id))
        .where(Inscripcion.ciclo_lectivo == ciclo)
        .group_by(Inscripcion.tipo, Inscripcion.estado)
        .order_by(Inscripcion.tipo, Inscripcion.estado)
    ).all()
    return {(tipo, estado): cantidad for tipo, estado, cantidad in filas}


def _resumen_inscripciones(
    contexto: ContextoHerramienta, parametros: ParametrosCiclo
) -> ResultadoHerramienta:
    ciclo = parametros.ciclo_lectivo or contexto.ciclo_lectivo
    por_tipo_estado = _inscripciones_por_tipo_estado(contexto, ciclo)
    admisiones = contexto.db.execute(
        select(SolicitudInscripcion.etapa, func.count(SolicitudInscripcion.id))
        .where(
            SolicitudInscripcion.ciclo_lectivo == ciclo,
            SolicitudInscripcion.estado == "en_proceso",
        )
        .group_by(SolicitudInscripcion.etapa)
        .order_by(SolicitudInscripcion.etapa)
    ).all()
    ciclo_anterior = str(int(ciclo) - 1) if ciclo.isdigit() else None
    comparar = parametros.comparar_con_anterior and ciclo_anterior is not None
    previas = _inscripciones_por_tipo_estado(contexto, ciclo_anterior) if comparar else {}
    claves = sorted(por_tipo_estado.keys() | previas.keys())
    filas_inscripciones = []
    for tipo, estado in claves:
        cantidad = por_tipo_estado.get((tipo, estado), 0)
        fila = {
            "tipo": tipo,
            "estado": estado,
            "cantidad": cantidad,
            # No es una columna: es la etiqueta del eje X si se pide el gráfico.
            "categoria": f"{tipo} / {estado}",
        }
        if comparar:
            previa = previas.get((tipo, estado), 0)
            fila["cantidad_anterior"] = previa
            fila["variacion"] = variacion_porcentual(cantidad, previa)
        filas_inscripciones.append(fila)
    filas_admisiones = [{"etapa": etapa, "cantidad": cantidad} for etapa, cantidad in admisiones]
    periodo = f"ciclo lectivo {ciclo}"
    fuente = "Inscripciones"
    columnas = [
        {"clave": "tipo", "etiqueta": "Tipo", "tipo": "texto"},
        {"clave": "estado", "etiqueta": "Estado", "tipo": "texto"},
        {"clave": "cantidad", "etiqueta": "Cantidad", "tipo": "numero"},
    ]
    para_llm: dict[str, object] = {
        "periodo": periodo,
        "fuente": fuente,
        "inscripciones": filas_inscripciones,
        "admisiones_en_proceso_por_etapa": filas_admisiones,
    }
    series = ["cantidad"]
    kpi: list[dict] = []
    if comparar:
        columnas += [
            {"clave": "cantidad_anterior", "etiqueta": "Cantidad anterior", "tipo": "numero"},
            {"clave": "variacion", "etiqueta": "Variación", "tipo": "porcentaje"},
        ]
        series.append("cantidad_anterior")
        total = sum(por_tipo_estado.values())
        total_previo = sum(previas.values())
        periodo_previo = f"ciclo lectivo {ciclo_anterior}"
        variacion = variacion_porcentual(total, total_previo)
        # El modelo no calcula: los totales y la variación vienen resueltos.
        para_llm["periodo_anterior"] = periodo_previo
        para_llm["totales"] = {
            "actual": total,
            "anterior": total_previo,
            "variacion_porcentual": variacion,
        }
        kpi.append(
            bloque_kpi(
                "Inscripciones (total)",
                total,
                periodo=periodo,
                fuente=fuente,
                variacion=variacion,
                periodo_comparado=periodo_previo,
                mejora="alza",
                valor_anterior=total_previo,
            )
        )
    tabla = bloque_tabla(
        "Inscripciones por tipo y estado",
        columnas,
        filas_inscripciones,
        periodo=periodo,
        fuente=fuente,
    )
    en_proceso = sum(cantidad for _, cantidad in admisiones)
    if en_proceso:
        # Las admisiones por etapa quedan en `para_llm`: una respuesta muestra una sola tabla.
        kpi.append(
            bloque_kpi(
                "Admisiones en proceso",
                en_proceso,
                periodo=periodo,
                fuente="Admisiones",
            )
        )
    bloques = [*kpi]
    agregar_tabla(bloques, tabla)
    agregar_grafico(bloques, tabla, parametros.grafico, eje_x="categoria", series=series)
    return ResultadoHerramienta(para_llm=para_llm, bloques=bloques)


class ParametrosTendencia(BaseModel):
    ciclo_lectivo: str | None = Field(
        default=None, description="Año del ciclo lectivo. Si falta, el seleccionado en pantalla."
    )
    desde: date | None = Field(
        default=None, description="Inicio, AAAA-MM-DD. Por defecto, 30 días atrás."
    )
    hasta: date | None = Field(default=None, description="Fin, AAAA-MM-DD. Por defecto, hoy.")
    agrupar_por: Literal["dia", "semana", "mes"] = Field(
        default="semana",
        description="`dia` para un día puntual o pocos días (hasta 62 días de período).",
    )
    comparar_con_anterior: bool = Field(
        default=False,
        description="Suma el período anterior de igual duración y la diferencia de presencia.",
    )
    grafico: FormaGrafico | None = Field(
        default=None, description="Solo si conviene verlo en un gráfico o lo piden."
    )


def _clave_periodo(dia: date, agrupar_por: str) -> str:
    if agrupar_por == "dia":
        return fecha_ar(dia)
    if agrupar_por == "mes":
        return mes_ar(dia.year, dia.month)
    lunes = dia - timedelta(days=dia.weekday())
    return f"semana del {fecha_ar(lunes)}"


def _periodos_de_asistencia(
    contexto: ContextoHerramienta, ciclo: str, desde: date, hasta: date, agrupar_por: str
) -> list[dict]:
    registros = contexto.db.execute(
        select(Asistencia.fecha, Asistencia.tipo, func.count(Asistencia.id))
        .join(Inscripcion, Inscripcion.id == Asistencia.inscripcion_id)
        .where(
            Inscripcion.ciclo_lectivo == ciclo,
            Asistencia.fecha >= desde,
            Asistencia.fecha <= hasta,
        )
        .group_by(Asistencia.fecha, Asistencia.tipo)
    ).all()

    periodos: dict[str, dict[str, int]] = {}
    dia = desde
    while dia <= hasta:
        periodos.setdefault(
            _clave_periodo(dia, agrupar_por),
            {"registros": 0, "presentes": 0, "tardanzas": 0, "ausentes": 0},
        )
        dia += timedelta(days=1)
    for fecha, tipo, cantidad in registros:
        acumulado = periodos[_clave_periodo(fecha, agrupar_por)]
        acumulado["registros"] += cantidad
        if tipo == "presente":
            acumulado["presentes"] += cantidad
        elif tipo == "tardanza":
            acumulado["tardanzas"] += cantidad
        else:
            acumulado["ausentes"] += cantidad

    return [
        {
            "periodo": clave,
            **valores,
            # `None` = sin registros en ese período, que no es lo mismo que 0 % de presencia.
            "porcentaje_presencia": porcentaje(
                valores["presentes"] + valores["tardanzas"], valores["registros"]
            ),
        }
        for clave, valores in periodos.items()
    ]


def _diferencia_puntos(actual: float | None, previo: float | None) -> float | None:
    """Diferencia en puntos porcentuales; `None` si falta alguno de los dos."""
    return None if actual is None or previo is None else round(actual - previo, 1)


def _tendencia_asistencias(
    contexto: ContextoHerramienta, parametros: ParametrosTendencia
) -> ResultadoHerramienta:
    ciclo = parametros.ciclo_lectivo or contexto.ciclo_lectivo
    hasta = parametros.hasta or contexto.hoy
    desde = parametros.desde or hasta - timedelta(days=30)
    if desde > hasta or (hasta - desde).days > MAX_DIAS_PERIODO:
        return ResultadoHerramienta(
            para_llm={"error": "El período es inválido o supera un año. Pedí uno más corto."}
        )
    if parametros.agrupar_por == "dia" and (hasta - desde).days >= _MAX_DIAS_POR_DIA:
        return ResultadoHerramienta(
            para_llm={
                "error": "Por día solo se pueden pedir hasta 62 días. Agrupá por semana o mes."
            }
        )
    filas = _periodos_de_asistencia(contexto, ciclo, desde, hasta, parametros.agrupar_por)
    periodo = f"{fecha_ar(desde)} a {fecha_ar(hasta)}, ciclo {ciclo}"
    fuente = "Asistencias (Inscripciones)"
    columnas = [
        {"clave": "periodo", "etiqueta": "Período", "tipo": "texto"},
        {"clave": "ausentes", "etiqueta": "Ausentes", "tipo": "numero"},
        {"clave": "porcentaje_presencia", "etiqueta": "Presencia", "tipo": "porcentaje"},
    ]
    para_llm: dict[str, object] = {
        "periodo": periodo,
        "fuente": fuente,
        "criterio": "la tardanza cuenta como presencia; presencia null = sin registros",
    }
    kpi: list[dict] = []
    if parametros.comparar_con_anterior:
        # Igual cantidad de días, terminando el día anterior al inicio pedido.
        hasta_ant = desde - timedelta(days=1)
        desde_ant = hasta_ant - (hasta - desde)
        ciclo_ant = (
            str(int(ciclo) - 1) if ciclo.isdigit() and desde_ant.year < desde.year else ciclo
        )
        anteriores = _periodos_de_asistencia(
            contexto, ciclo_ant, desde_ant, hasta_ant, parametros.agrupar_por
        )
        # Se compara período a período por posición, como en la evolución financiera.
        for indice, fila in enumerate(filas):
            previo = anteriores[indice] if indice < len(anteriores) else None
            fila["presencia_anterior"] = None if previo is None else previo["porcentaje_presencia"]
            fila["diferencia_presencia"] = _diferencia_puntos(
                fila["porcentaje_presencia"], fila["presencia_anterior"]
            )
        columnas += [
            {"clave": "presencia_anterior", "etiqueta": "Presencia anterior", "tipo": "porcentaje"},
            {"clave": "diferencia_presencia", "etiqueta": "Dif. (pp)", "tipo": "numero"},
        ]
        periodo_ant = f"{fecha_ar(desde_ant)} a {fecha_ar(hasta_ant)}"
        total = {k: sum(f[k] for f in filas) for k in ("registros", "presentes", "tardanzas")}
        total_ant = {
            k: sum(f[k] for f in anteriores) for k in ("registros", "presentes", "tardanzas")
        }
        ausentes = sum(f["ausentes"] for f in filas)
        ausentes_ant = sum(f["ausentes"] for f in anteriores)
        presencia = porcentaje(total["presentes"] + total["tardanzas"], total["registros"])
        presencia_ant = porcentaje(
            total_ant["presentes"] + total_ant["tardanzas"], total_ant["registros"]
        )
        variacion = variacion_porcentual(ausentes, ausentes_ant)
        # El modelo no calcula: los totales y las diferencias vienen resueltos.
        para_llm["periodo_anterior"] = periodo_ant
        para_llm["totales"] = {
            "presencia_actual": presencia,
            "presencia_anterior": presencia_ant,
            "diferencia_presencia_puntos": _diferencia_puntos(presencia, presencia_ant),
            "ausentes_actual": ausentes,
            "ausentes_anterior": ausentes_ant,
            "variacion_ausentes_porcentual": variacion,
        }
        kpi.append(
            bloque_kpi(
                "Ausentes (total)",
                ausentes,
                periodo=f"{fecha_ar(desde)} a {fecha_ar(hasta)}",
                fuente=fuente,
                variacion=variacion,
                periodo_comparado=periodo_ant,
                mejora="baja",
                # Sin asistencias cargadas en el período anterior no hay con qué comparar.
                valor_anterior=ausentes_ant if total_ant["registros"] > 0 else None,
            )
        )
    para_llm["periodos"] = filas
    tabla = bloque_tabla("Asistencia por período", columnas, filas, periodo=periodo, fuente=fuente)
    bloques = [*kpi]
    agregar_tabla(bloques, tabla)
    # Las series son columnas visibles: el gráfico toma de ahí la etiqueta y el tipo.
    agregar_grafico(bloques, tabla, parametros.grafico, eje_x="periodo", series=["ausentes"])
    return ResultadoHerramienta(para_llm=para_llm, bloques=bloques)


class ParametrosAusentes(BaseModel):
    fecha: date | None = Field(default=None, description="Día, AAAA-MM-DD. Por defecto, hoy.")
    limite: int = Field(default=20, ge=1, le=100, description="Cuántos alumnos devolver.")


def _ausentes_del_dia(
    contexto: ContextoHerramienta, parametros: ParametrosAusentes
) -> ResultadoHerramienta:
    dia = parametros.fecha or contexto.hoy
    limite = min(parametros.limite, contexto.max_filas)
    condiciones = (Asistencia.fecha == dia, Asistencia.tipo.in_(TIPOS_AUSENTE))
    total = contexto.db.execute(select(func.count(Asistencia.id)).where(*condiciones)).scalar_one()
    registros = contexto.db.execute(
        select(
            Inscripcion.alumno_id,
            Asistencia.tipo,
            NivelEducativo.nombre,
            Anio.numero,
            Division.nombre,
        )
        .select_from(Asistencia)
        .join(Inscripcion, Inscripcion.id == Asistencia.inscripcion_id)
        .join(Division, Division.id == Inscripcion.division_id)
        .join(Anio, Anio.id == Division.anio_id)
        .join(NivelEducativo, NivelEducativo.id == Anio.nivel_educativo_id)
        .where(*condiciones)
        .order_by(NivelEducativo.nombre, Anio.numero, Division.nombre, Inscripcion.alumno_id)
        .limit(limite)
    ).all()
    filas = [
        {
            "alumno": obtener_o_crear_alias(
                contexto.db, contexto.conversacion_id, TIPO_ALIAS_ALUMNO, alumno_id
            ),
            "tipo": tipo.removeprefix("ausente_"),
            "curso": f"{nivel} {anio}{division}",
        }
        for alumno_id, tipo, nivel, anio, division in registros
    ]
    periodo = fecha_ar(dia)
    fuente = "Asistencias (Inscripciones)"
    bloques: list[dict] = []
    agregar_tabla(
        bloques,
        bloque_tabla(
            "Ausentes del día",
            [
                {"clave": "alumno", "etiqueta": "Alumno", "tipo": "alias"},
                {"clave": "curso", "etiqueta": "Curso", "tipo": "texto"},
                {"clave": "tipo", "etiqueta": "Tipo", "tipo": "texto"},
            ],
            filas,
            periodo=periodo,
            fuente=fuente,
        ),
    )
    return ResultadoHerramienta(
        para_llm={
            "periodo": periodo,
            "fuente": fuente,
            "ausentes_en_total": total,
            "alumnos_devueltos": len(filas),
            "ausentes": filas,
        },
        bloques=bloques,
    )


class ParametrosFichaAlumno(BaseModel):
    alias: str = Field(description="Alias del alumno, por ejemplo [ALUMNO:1].")


def _ficha_alumno(
    contexto: ContextoHerramienta, parametros: ParametrosFichaAlumno
) -> ResultadoHerramienta:
    fila_alias = resolver_alias(contexto.db, contexto.conversacion_id, parametros.alias)
    if fila_alias.tipo != TIPO_ALIAS_ALUMNO:
        return ResultadoHerramienta(para_llm={"error": "El alias no es de un alumno."})
    alumno = contexto.db.get(Alumno, fila_alias.entidad_id)
    if alumno is None:
        return ResultadoHerramienta(para_llm={"error": "El alumno ya no existe."})

    ciclo = contexto.ciclo_lectivo
    datos: dict[str, object] = {"alumno": parametros.alias, "estado": alumno.estado}
    bloques = [bloque_tarjeta("alumno", parametros.alias)]
    sin_permiso: list[str] = []

    inscripcion = contexto.db.execute(
        select(Inscripcion, Division, Anio, NivelEducativo)
        .join(Division, Division.id == Inscripcion.division_id)
        .join(Anio, Anio.id == Division.anio_id)
        .join(NivelEducativo, NivelEducativo.id == Anio.nivel_educativo_id)
        .where(Inscripcion.alumno_id == alumno.id, Inscripcion.ciclo_lectivo == ciclo)
        .order_by(Inscripcion.fecha_inscripcion.desc())
    ).first()
    if inscripcion is None:
        datos["inscripcion"] = f"sin inscripción en el ciclo {ciclo}"
    else:
        insc, division, anio, nivel = inscripcion
        datos["inscripcion"] = {
            "ciclo_lectivo": ciclo,
            "nivel": nivel.nombre,
            "anio": anio.numero,
            "division": division.nombre,
            "estado": insc.estado,
        }

    if contexto.tiene_permiso(PERMISO_ACADEMICO_LEER):
        conteos = dict(
            contexto.db.execute(
                select(Asistencia.tipo, func.count(Asistencia.id))
                .join(Inscripcion, Inscripcion.id == Asistencia.inscripcion_id)
                .where(Inscripcion.alumno_id == alumno.id, Inscripcion.ciclo_lectivo == ciclo)
                .group_by(Asistencia.tipo)
            ).all()
        )
        total = sum(conteos.values())
        presencia = porcentaje(conteos.get("presente", 0) + conteos.get("tardanza", 0), total)
        datos["asistencia"] = {
            "periodo": f"ciclo lectivo {ciclo}",
            "registros": total,
            "por_tipo": conteos,
            "porcentaje_presencia": presencia,
            "criterio": "la tardanza cuenta como presencia; null = sin registros",
        }
        bloques.append(
            bloque_kpi(
                "Presencia",
                presencia,
                unidad="%",
                periodo=f"ciclo {ciclo}, {total} registros",
                fuente="Asistencias",
            )
        )
    else:
        sin_permiso.append("asistencia")

    if contexto.tiene_permiso(PERMISO_FACTURACION_LEER):
        cuenta, debe, haber, saldo = obtener_resumen_cuenta(contexto.db, alumno.id)
        datos["cuenta_corriente"] = (
            "sin movimientos"
            if cuenta is None
            else {"debe": numero(debe), "haber": numero(haber), "saldo": numero(saldo)}
        )
        bloques.append(
            bloque_kpi(
                "Saldo de cuenta corriente",
                numero(saldo),
                unidad="$",
                periodo=f"al {fecha_ar(contexto.hoy)}",
                fuente="Cuenta corriente",
            )
        )
    else:
        sin_permiso.append("cuenta_corriente")

    if sin_permiso:
        datos["secciones_sin_permiso"] = sin_permiso
    return ResultadoHerramienta(para_llm=datos, bloques=bloques)


class ParametrosBuscarRecurso(BaseModel):
    tipo: Literal["alumno"] = "alumno"
    legajo: str = Field(max_length=30, description="Número de legajo del alumno.")


def _buscar_recurso(
    contexto: ContextoHerramienta, parametros: ParametrosBuscarRecurso
) -> ResultadoHerramienta:
    """Los nombres no llegan hasta acá: se resolvieron antes como alias. Se busca por legajo."""
    alumno = contexto.db.scalar(
        select(Alumno).where(Alumno.numero_legajo == parametros.legajo.strip())
    )
    if alumno is None:
        return ResultadoHerramienta(para_llm={"resultado": "sin coincidencias"})
    alias = obtener_o_crear_alias(
        contexto.db, contexto.conversacion_id, TIPO_ALIAS_ALUMNO, alumno.id
    )
    return ResultadoHerramienta(
        para_llm={"resultado": "encontrado", "alumno": alias},
        bloques=[bloque_tarjeta("alumno", alias)],
    )


HERRAMIENTAS = [
    Herramienta(
        nombre="resumen_inscripciones",
        descripcion="Inscripciones del ciclo por tipo y estado, y admisiones en proceso por etapa.",
        parametros=ParametrosCiclo,
        permisos=(PERMISO_INSCRIPCIONES_LEER,),
        ejecutar=_resumen_inscripciones,
        destino="inscripciones",
    ),
    Herramienta(
        nombre="tendencia_asistencias",
        descripcion=(
            "Asistencia de toda la institución agrupada por día, semana o mes, de cualquier "
            "período pasado (también 'ayer'). Distingue períodos sin registros de un 0 % de "
            "presencia."
        ),
        parametros=ParametrosTendencia,
        permisos=(PERMISO_ACADEMICO_LEER,),
        ejecutar=_tendencia_asistencias,
        destino="historial_asistencia",
    ),
    Herramienta(
        nombre="ausentes_del_dia",
        descripcion=(
            "Alumnos ausentes en un día puntual, hoy o pasado (también 'ayer'), con curso y "
            "tipo de ausencia. Cada alumno viene como alias, sin nombre ni DNI. Para solo la "
            "cantidad usá tendencia_asistencias; para el ranking de un período usá "
            "alumnos_con_mas_inasistencias."
        ),
        parametros=ParametrosAusentes,
        permisos=(PERMISO_ACADEMICO_LEER, PERMISO_FAMILIAS_ALUMNOS_LEER),
        ejecutar=_ausentes_del_dia,
        destino="historial_asistencia",
    ),
    Herramienta(
        nombre="ficha_alumno",
        descripcion=(
            "Datos de un alumno (identificado por alias): inscripción del ciclo, asistencia y "
            "cuenta corriente, según lo que el rol pueda ver."
        ),
        parametros=ParametrosFichaAlumno,
        permisos=(PERMISO_FAMILIAS_ALUMNOS_LEER,),
        ejecutar=_ficha_alumno,
    ),
    Herramienta(
        nombre="buscar_recurso",
        descripcion=(
            "Busca un alumno por número de legajo y devuelve su alias y una tarjeta para abrirlo. "
            "Los nombres no se buscan acá: las personas mencionadas ya llegan como alias."
        ),
        parametros=ParametrosBuscarRecurso,
        permisos=(PERMISO_FAMILIAS_ALUMNOS_LEER,),
        ejecutar=_buscar_recurso,
    ),
]
