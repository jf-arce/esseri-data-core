"""Inasistencias por alumno y por curso, y estado de las justificaciones.

Inasistencia = tipos `ausente_*`; la tardanza cuenta como presencia. "Sin justificar" es
`ausente_pendiente` + `ausente_injustificado`. Los alumnos salen como alias, sin nombres.
"""

import uuid
from datetime import date, timedelta
from typing import Any, Literal

from pydantic import Field
from sqlalchemy import case, desc, func, select

from src.academico.horarios_service import etiqueta_division
from src.academico.models import Division, JustificacionInasistencia, MotivoJustificacion
from src.asistente.constants import (
    MAX_DIAS_PERIODO,
    TIPO_ALIAS_ALUMNO,
    TIPOS_AUSENTE,
    TIPOS_AUSENTE_SIN_JUSTIFICAR,
)
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
    porcentaje,
    variacion_porcentual,
)
from src.asistente.herramientas_cursos import (
    ParametrosCurso,
    divisiones_del_filtro,
    sin_curso,
)
from src.asistente.seudonimos_service import obtener_o_crear_alias
from src.auth.constants import (
    PERMISO_ACADEMICO_ACTUALIZAR_JUSTIFICACIONES,
    PERMISO_ACADEMICO_LEER,
    PERMISO_FAMILIAS_ALUMNOS_LEER,
)
from src.inscripciones.models import Asistencia, Inscripcion

_FUENTE_ASISTENCIAS = "Asistencias (Inscripciones)"
_FUENTE_JUSTIFICACIONES = "Justificaciones (Académico)"
_ESTADOS_JUSTIFICACION = ("pendiente", "aprobada", "rechazada")


class ParametrosPeriodo(ParametrosCurso):
    ciclo_lectivo: str | None = Field(
        default=None, description="Año del ciclo lectivo. Si falta, el seleccionado en pantalla."
    )
    desde: date | None = Field(
        default=None, description="Inicio, AAAA-MM-DD. Por defecto, el inicio del ciclo."
    )
    hasta: date | None = Field(default=None, description="Fin, AAAA-MM-DD. Por defecto, hoy.")
    limite: int = Field(default=10, ge=1, le=50, description="Cuántas filas devolver.")


def _ciclo_anterior(ciclo: str, desde: date, desde_ant: date) -> str:
    return str(int(ciclo) - 1) if ciclo.isdigit() and desde_ant.year < desde.year else ciclo


def _periodo(
    contexto: ContextoHerramienta, ciclo: str, desde: date | None, hasta: date | None
) -> tuple[date, date] | str:
    """Fechas del período (por defecto, el ciclo hasta hoy) o el mensaje de error."""
    fin = hasta or contexto.hoy
    inicio = desde or (date(int(ciclo), 1, 1) if ciclo.isdigit() else fin - timedelta(days=365))
    if inicio > fin or (fin - inicio).days > MAX_DIAS_PERIODO:
        return "El período es inválido o supera un año. Pedí uno más corto."
    return inicio, fin


def _periodo_anterior(desde: date, hasta: date) -> tuple[date, date]:
    """Igual cantidad de días, terminando el día anterior al inicio pedido."""
    hasta_ant = desde - timedelta(days=1)
    return hasta_ant - (hasta - desde), hasta_ant


def _ids_de_curso(
    contexto: ContextoHerramienta, parametros: ParametrosCurso
) -> list[uuid.UUID] | None | str:
    """Divisiones del filtro; `None` si no se filtró por curso; mensaje si no hay coincidencias."""
    if parametros.nivel is None and parametros.anio is None and parametros.division is None:
        return None
    divisiones = divisiones_del_filtro(contexto.db, parametros)
    if not divisiones:
        return "No hay un curso que coincida con ese filtro."
    return [d.id for d in divisiones]


def _etiquetas_de_curso(contexto: ContextoHerramienta, ids: set[uuid.UUID]) -> dict[uuid.UUID, str]:
    return {
        d.id: etiqueta_division(d)
        for d in contexto.db.scalars(select(Division).where(Division.id.in_(ids)))
    }


def _curso_en_texto(ids: list[uuid.UUID] | None) -> str:
    return "toda la institución" if ids is None else f"{len(ids)} curso(s)"


# --- Alumnos con más inasistencias ------------------------------------------------------------


class ParametrosAlumnosInasistencias(ParametrosPeriodo):
    solo_sin_justificar: bool = Field(
        default=False, description="Cuenta y ordena solo las inasistencias sin justificar."
    )
    presencia_maxima: float | None = Field(
        default=None,
        ge=0,
        le=100,
        description="Solo alumnos con presencia igual o menor a este porcentaje, por ejemplo 85.",
    )
    grafico: FormaGrafico | None = Field(
        default=None,
        description="Verlo como gráfico: para comparar 3 o más categorías o ver una evolución.",
    )


def _alumnos_con_mas_inasistencias(
    contexto: ContextoHerramienta, parametros: ParametrosAlumnosInasistencias
) -> ResultadoHerramienta:
    ciclo = parametros.ciclo_lectivo or contexto.ciclo_lectivo
    periodo_fechas = _periodo(contexto, ciclo, parametros.desde, parametros.hasta)
    if isinstance(periodo_fechas, str):
        return sin_curso(periodo_fechas)
    desde, hasta = periodo_fechas
    ids = _ids_de_curso(contexto, parametros)
    if isinstance(ids, str):
        return sin_curso(ids)

    registros = func.count(Asistencia.id)
    ausentes = func.count(case((Asistencia.tipo.in_(TIPOS_AUSENTE), 1)))
    sin_justificar = func.count(case((Asistencia.tipo.in_(TIPOS_AUSENTE_SIN_JUSTIFICAR), 1)))
    cuenta = sin_justificar if parametros.solo_sin_justificar else ausentes
    consulta = (
        select(Inscripcion.alumno_id, Inscripcion.division_id, registros, ausentes, sin_justificar)
        .select_from(Asistencia)
        .join(Inscripcion, Inscripcion.id == Asistencia.inscripcion_id)
        .where(
            Inscripcion.ciclo_lectivo == ciclo,
            Asistencia.fecha >= desde,
            Asistencia.fecha <= hasta,
        )
        .group_by(Inscripcion.alumno_id, Inscripcion.division_id)
        .having(cuenta > 0)
    )
    if ids is not None:
        consulta = consulta.where(Inscripcion.division_id.in_(ids))
    if parametros.presencia_maxima is not None:
        consulta = consulta.having(
            (registros - ausentes) * 100.0 / registros <= parametros.presencia_maxima
        )
    total = contexto.db.execute(select(func.count()).select_from(consulta.subquery())).scalar_one()
    limite = min(parametros.limite, contexto.max_filas)
    registrados = contexto.db.execute(
        consulta.order_by(desc(cuenta), desc(ausentes), Inscripcion.alumno_id).limit(limite)
    ).all()
    cursos = _etiquetas_de_curso(contexto, {division_id for _, division_id, *_ in registrados})
    filas = [
        {
            "alumno": obtener_o_crear_alias(
                contexto.db, contexto.conversacion_id, TIPO_ALIAS_ALUMNO, alumno_id
            ),
            "curso": cursos[division_id],
            "inasistencias": faltas,
            "sin_justificar": sin_just,
            "presencia": porcentaje(registrados_alumno - faltas, registrados_alumno),
        }
        for alumno_id, division_id, registrados_alumno, faltas, sin_just in registrados
    ]
    periodo = f"{fecha_ar(desde)} a {fecha_ar(hasta)}, ciclo {ciclo}"
    bloques: list[dict[str, Any]] = []
    tabla = bloque_tabla(
        "Alumnos con más inasistencias",
        [
            {"clave": "alumno", "etiqueta": "Alumno", "tipo": "alias"},
            {"clave": "curso", "etiqueta": "Curso", "tipo": "texto"},
            {"clave": "inasistencias", "etiqueta": "Inasistencias", "tipo": "numero"},
            {"clave": "sin_justificar", "etiqueta": "Sin justificar", "tipo": "numero"},
        ],
        filas,
        periodo=periodo,
        fuente=_FUENTE_ASISTENCIAS,
    )
    agregar_tabla(bloques, tabla)
    agregar_grafico(
        bloques,
        tabla,
        parametros.grafico,
        eje_x="alumno",
        series=["inasistencias", "sin_justificar"],
    )
    return ResultadoHerramienta(
        para_llm={
            "periodo": periodo,
            "fuente": _FUENTE_ASISTENCIAS,
            "alcance": _curso_en_texto(ids),
            "criterio": (
                "inasistencia = ausente (justificado o no); sin justificar = pendiente o "
                "injustificado; la tardanza cuenta como presencia"
            ),
            "alumnos_en_total": total,
            "alumnos_devueltos": len(filas),
            "alumnos": filas,
        },
        bloques=bloques,
    )


# --- Asistencia por curso ---------------------------------------------------------------------


class ParametrosAsistenciaPorCurso(ParametrosPeriodo):
    comparar_con_anterior: bool = Field(
        default=False,
        description="Suma el período anterior de igual duración y la diferencia de presencia.",
    )
    grafico: FormaGrafico | None = Field(
        default=None, description="Solo si conviene verlo en un gráfico o lo piden."
    )


def _asistencia_de_cursos(
    contexto: ContextoHerramienta,
    ciclo: str,
    desde: date,
    hasta: date,
    ids: list[uuid.UUID] | None,
) -> dict[uuid.UUID, tuple[int, int]]:
    """Por división: (registros, inasistencias) del período."""
    consulta = (
        select(
            Inscripcion.division_id,
            func.count(Asistencia.id),
            func.count(case((Asistencia.tipo.in_(TIPOS_AUSENTE), 1))),
        )
        .select_from(Asistencia)
        .join(Inscripcion, Inscripcion.id == Asistencia.inscripcion_id)
        .where(
            Inscripcion.ciclo_lectivo == ciclo,
            Asistencia.fecha >= desde,
            Asistencia.fecha <= hasta,
        )
        .group_by(Inscripcion.division_id)
    )
    if ids is not None:
        consulta = consulta.where(Inscripcion.division_id.in_(ids))
    return {
        division_id: (registros, ausentes)
        for division_id, registros, ausentes in contexto.db.execute(consulta)
    }


def _presencia(registros: int, ausentes: int) -> float | None:
    return porcentaje(registros - ausentes, registros)


def _asistencia_por_curso(
    contexto: ContextoHerramienta, parametros: ParametrosAsistenciaPorCurso
) -> ResultadoHerramienta:
    ciclo = parametros.ciclo_lectivo or contexto.ciclo_lectivo
    periodo_fechas = _periodo(contexto, ciclo, parametros.desde, parametros.hasta)
    if isinstance(periodo_fechas, str):
        return sin_curso(periodo_fechas)
    desde, hasta = periodo_fechas
    ids = _ids_de_curso(contexto, parametros)
    if isinstance(ids, str):
        return sin_curso(ids)

    alumnos = dict(
        contexto.db.execute(
            select(Inscripcion.division_id, func.count(Inscripcion.id))
            .where(Inscripcion.ciclo_lectivo == ciclo, Inscripcion.estado == "activa")
            .group_by(Inscripcion.division_id)
        ).all()
    )
    actual = _asistencia_de_cursos(contexto, ciclo, desde, hasta, ids)
    comparar = parametros.comparar_con_anterior
    anterior: dict[uuid.UUID, tuple[int, int]] = {}
    desde_ant, hasta_ant = _periodo_anterior(desde, hasta)
    if comparar:
        anterior = _asistencia_de_cursos(
            contexto, _ciclo_anterior(ciclo, desde, desde_ant), desde_ant, hasta_ant, ids
        )
    divisiones = {
        division_id for division_id in (*alumnos, *actual) if ids is None or division_id in ids
    }
    cursos = _etiquetas_de_curso(contexto, divisiones)
    filas: list[dict[str, Any]] = []
    for division_id in divisiones:
        registros, ausentes = actual.get(division_id, (0, 0))
        fila: dict[str, Any] = {
            "curso": cursos[division_id],
            "alumnos": alumnos.get(division_id, 0),
            "inasistencias": ausentes,
            "porcentaje_presencia": _presencia(registros, ausentes),
        }
        if comparar:
            previa = _presencia(*anterior.get(division_id, (0, 0)))
            fila["presencia_anterior"] = previa
            fila["diferencia_presencia"] = (
                None
                if previa is None or fila["porcentaje_presencia"] is None
                else round(fila["porcentaje_presencia"] - previa, 1)
            )
        filas.append(fila)
    # Menos presencia primero; los cursos sin registros al final.
    filas.sort(
        key=lambda f: (
            f["porcentaje_presencia"] is None,
            f["porcentaje_presencia"] or 0,
            f["curso"],
        )
    )
    total_filas = len(filas)
    filas = filas[: min(parametros.limite, contexto.max_filas)]

    periodo = f"{fecha_ar(desde)} a {fecha_ar(hasta)}, ciclo {ciclo}"
    columnas = [
        {"clave": "curso", "etiqueta": "Curso", "tipo": "texto"},
        {"clave": "alumnos", "etiqueta": "Alumnos", "tipo": "numero"},
        {"clave": "inasistencias", "etiqueta": "Inasistencias", "tipo": "numero"},
        {"clave": "porcentaje_presencia", "etiqueta": "Presencia", "tipo": "porcentaje"},
    ]
    para_llm: dict[str, Any] = {
        "periodo": periodo,
        "fuente": _FUENTE_ASISTENCIAS,
        "criterio": "la tardanza cuenta como presencia; presencia null = sin registros",
        "cursos_en_total": total_filas,
        "cursos": filas,
    }
    bloques: list[dict[str, Any]] = []
    if comparar:
        columnas += [
            {"clave": "presencia_anterior", "etiqueta": "Presencia anterior", "tipo": "porcentaje"},
            {"clave": "diferencia_presencia", "etiqueta": "Dif. (pp)", "tipo": "numero"},
        ]
        registros, ausentes = (sum(v[i] for v in actual.values()) for i in (0, 1))
        registros_ant, ausentes_ant = (sum(v[i] for v in anterior.values()) for i in (0, 1))
        presencia = _presencia(registros, ausentes)
        presencia_ant = _presencia(registros_ant, ausentes_ant)
        periodo_ant = f"{fecha_ar(desde_ant)} a {fecha_ar(hasta_ant)}"
        para_llm["periodo_anterior"] = periodo_ant
        para_llm["totales"] = {
            "presencia_actual": presencia,
            "presencia_anterior": presencia_ant,
            "diferencia_presencia_puntos": (
                None
                if presencia is None or presencia_ant is None
                else round(presencia - presencia_ant, 1)
            ),
        }
        if presencia is not None:
            bloques.append(
                bloque_kpi(
                    "Presencia",
                    presencia,
                    unidad="%",
                    periodo=periodo,
                    fuente=_FUENTE_ASISTENCIAS,
                    variacion=(
                        None
                        if presencia_ant is None
                        else variacion_porcentual(presencia, presencia_ant)
                    ),
                    periodo_comparado=periodo_ant,
                    mejora="alza",
                    valor_anterior=presencia_ant,
                )
            )
    tabla = bloque_tabla(
        "Asistencia por curso", columnas, filas, periodo=periodo, fuente=_FUENTE_ASISTENCIAS
    )
    agregar_tabla(bloques, tabla)
    agregar_grafico(
        bloques, tabla, parametros.grafico, eje_x="curso", series=["porcentaje_presencia"]
    )
    return ResultadoHerramienta(para_llm=para_llm, bloques=bloques)


# --- Justificaciones --------------------------------------------------------------------------


class ParametrosResumenJustificaciones(ParametrosPeriodo):
    agrupar_por: Literal["estado", "motivo"] = Field(
        default="estado", description="`estado` (pendiente, aprobada, rechazada) o `motivo`."
    )
    comparar_con_anterior: bool = Field(
        default=False,
        description="Suma el período anterior de igual duración y la variación de pendientes.",
    )
    grafico: FormaGrafico | None = Field(
        default=None,
        description="Verlo como gráfico: para comparar 3 o más categorías o ver una evolución.",
    )


def _conteo_justificaciones(
    contexto: ContextoHerramienta,
    ciclo: str,
    desde: date,
    hasta: date,
    ids: list[uuid.UUID] | None,
    agrupar_por: str,
) -> dict[str, int]:
    """Justificaciones por estado o motivo, según la fecha de la inasistencia."""
    clave = (
        JustificacionInasistencia.estado if agrupar_por == "estado" else MotivoJustificacion.nombre
    )
    consulta = (
        select(clave, func.count(JustificacionInasistencia.id))
        .select_from(JustificacionInasistencia)
        .join(Asistencia, Asistencia.id == JustificacionInasistencia.asistencia_id)
        .join(Inscripcion, Inscripcion.id == Asistencia.inscripcion_id)
        .where(
            Inscripcion.ciclo_lectivo == ciclo,
            Asistencia.fecha >= desde,
            Asistencia.fecha <= hasta,
        )
        .group_by(clave)
    )
    if agrupar_por == "motivo":
        consulta = consulta.join(
            MotivoJustificacion,
            MotivoJustificacion.id == JustificacionInasistencia.motivo_justificacion_id,
        )
    if ids is not None:
        consulta = consulta.where(Inscripcion.division_id.in_(ids))
    return {nombre: cantidad for nombre, cantidad in contexto.db.execute(consulta)}


def _resumen_justificaciones(
    contexto: ContextoHerramienta, parametros: ParametrosResumenJustificaciones
) -> ResultadoHerramienta:
    ciclo = parametros.ciclo_lectivo or contexto.ciclo_lectivo
    periodo_fechas = _periodo(contexto, ciclo, parametros.desde, parametros.hasta)
    if isinstance(periodo_fechas, str):
        return sin_curso(periodo_fechas)
    desde, hasta = periodo_fechas
    ids = _ids_de_curso(contexto, parametros)
    if isinstance(ids, str):
        return sin_curso(ids)

    por_estado = parametros.agrupar_por == "estado"
    actual = _conteo_justificaciones(contexto, ciclo, desde, hasta, ids, parametros.agrupar_por)
    comparar = parametros.comparar_con_anterior
    desde_ant, hasta_ant = _periodo_anterior(desde, hasta)
    anterior = (
        _conteo_justificaciones(
            contexto,
            _ciclo_anterior(ciclo, desde, desde_ant),
            desde_ant,
            hasta_ant,
            ids,
            parametros.agrupar_por,
        )
        if comparar
        else {}
    )
    claves = (
        list(_ESTADOS_JUSTIFICACION)
        if por_estado
        else sorted(actual.keys() | anterior.keys(), key=lambda k: (-actual.get(k, 0), k))
    )
    etiqueta = "estado" if por_estado else "motivo"
    filas: list[dict[str, Any]] = []
    for clave in claves[: min(parametros.limite, contexto.max_filas)]:
        fila: dict[str, Any] = {etiqueta: clave, "cantidad": actual.get(clave, 0)}
        if comparar:
            fila["cantidad_anterior"] = anterior.get(clave, 0)
        filas.append(fila)

    periodo = f"{fecha_ar(desde)} a {fecha_ar(hasta)}, ciclo {ciclo}"
    columnas = [
        {"clave": etiqueta, "etiqueta": "Estado" if por_estado else "Motivo", "tipo": "texto"},
        {"clave": "cantidad", "etiqueta": "Cantidad", "tipo": "numero"},
    ]
    para_llm: dict[str, Any] = {
        "periodo": periodo,
        "fuente": _FUENTE_JUSTIFICACIONES,
        "alcance": _curso_en_texto(ids),
        "agrupado_por": etiqueta,
        "total": sum(actual.values()),
        "justificaciones": filas,
    }
    bloques: list[dict[str, Any]] = []
    if comparar:
        columnas.append(
            {"clave": "cantidad_anterior", "etiqueta": "Cantidad anterior", "tipo": "numero"}
        )
        periodo_ant = f"{fecha_ar(desde_ant)} a {fecha_ar(hasta_ant)}"
        para_llm["periodo_anterior"] = periodo_ant
        para_llm["total_anterior"] = sum(anterior.values())
        if por_estado:
            pendientes = actual.get("pendiente", 0)
            pendientes_ant = anterior.get("pendiente", 0)
            bloques.append(
                bloque_kpi(
                    "Justificaciones pendientes",
                    pendientes,
                    periodo=periodo,
                    fuente=_FUENTE_JUSTIFICACIONES,
                    variacion=variacion_porcentual(pendientes, pendientes_ant),
                    periodo_comparado=periodo_ant,
                    mejora="baja",
                    valor_anterior=pendientes_ant if anterior else None,
                )
            )
    tabla = bloque_tabla(
        "Justificaciones por estado" if por_estado else "Justificaciones por motivo",
        columnas,
        filas,
        periodo=periodo,
        fuente=_FUENTE_JUSTIFICACIONES,
    )
    agregar_tabla(bloques, tabla)
    agregar_grafico(
        bloques,
        tabla,
        parametros.grafico,
        eje_x=etiqueta,
        series=["cantidad", "cantidad_anterior"] if comparar else ["cantidad"],
    )
    return ResultadoHerramienta(para_llm=para_llm, bloques=bloques)


class ParametrosJustificacionesPendientes(ParametrosCurso):
    desde: date | None = Field(
        default=None, description="Fecha de la inasistencia desde, AAAA-MM-DD. Por defecto, todas."
    )
    hasta: date | None = Field(default=None, description="Fecha de la inasistencia hasta.")
    limite: int = Field(default=10, ge=1, le=50, description="Cuántas justificaciones devolver.")


def _justificaciones_pendientes(
    contexto: ContextoHerramienta, parametros: ParametrosJustificacionesPendientes
) -> ResultadoHerramienta:
    if parametros.desde and parametros.hasta and parametros.desde > parametros.hasta:
        return sin_curso("El período es inválido.")
    ids = _ids_de_curso(contexto, parametros)
    if isinstance(ids, str):
        return sin_curso(ids)

    condiciones = [JustificacionInasistencia.estado == "pendiente"]
    if ids is not None:
        condiciones.append(Inscripcion.division_id.in_(ids))
    if parametros.desde is not None:
        condiciones.append(Asistencia.fecha >= parametros.desde)
    if parametros.hasta is not None:
        condiciones.append(Asistencia.fecha <= parametros.hasta)
    base = (
        select(JustificacionInasistencia.id)
        .select_from(JustificacionInasistencia)
        .join(Asistencia, Asistencia.id == JustificacionInasistencia.asistencia_id)
        .join(Inscripcion, Inscripcion.id == Asistencia.inscripcion_id)
        .where(*condiciones)
    )
    total = contexto.db.execute(select(func.count()).select_from(base.subquery())).scalar_one()
    limite = min(parametros.limite, contexto.max_filas)
    registros = contexto.db.execute(
        select(
            Inscripcion.alumno_id,
            Inscripcion.division_id,
            Asistencia.fecha,
            MotivoJustificacion.nombre,
            JustificacionInasistencia.fecha_carga,
        )
        .select_from(JustificacionInasistencia)
        .join(Asistencia, Asistencia.id == JustificacionInasistencia.asistencia_id)
        .join(Inscripcion, Inscripcion.id == Asistencia.inscripcion_id)
        .join(
            MotivoJustificacion,
            MotivoJustificacion.id == JustificacionInasistencia.motivo_justificacion_id,
        )
        .where(*condiciones)
        .order_by(JustificacionInasistencia.fecha_carga, JustificacionInasistencia.id)
        .limit(limite)
    ).all()
    cursos = _etiquetas_de_curso(contexto, {division_id for _, division_id, *_ in registros})
    filas = [
        {
            "alumno": obtener_o_crear_alias(
                contexto.db, contexto.conversacion_id, TIPO_ALIAS_ALUMNO, alumno_id
            ),
            "curso": cursos[division_id],
            "fecha": fecha_ar(fecha),
            "motivo": motivo,
            "dias_esperando": max((contexto.hoy - fecha_carga.date()).days, 0),
        }
        for alumno_id, division_id, fecha, motivo, fecha_carga in registros
    ]
    periodo = f"al {fecha_ar(contexto.hoy)}"
    bloques: list[dict[str, Any]] = []
    agregar_tabla(
        bloques,
        bloque_tabla(
            "Justificaciones pendientes",
            [
                {"clave": "alumno", "etiqueta": "Alumno", "tipo": "alias"},
                {"clave": "curso", "etiqueta": "Curso", "tipo": "texto"},
                {"clave": "fecha", "etiqueta": "Fecha", "tipo": "texto"},
                {"clave": "motivo", "etiqueta": "Motivo", "tipo": "texto"},
                {"clave": "dias_esperando", "etiqueta": "Días esperando", "tipo": "numero"},
            ],
            filas,
            periodo=periodo,
            fuente=_FUENTE_JUSTIFICACIONES,
        ),
    )
    return ResultadoHerramienta(
        para_llm={
            "periodo": periodo,
            "fuente": _FUENTE_JUSTIFICACIONES,
            "alcance": _curso_en_texto(ids),
            "criterio": "orden: las que más esperan primero; fecha = día de la inasistencia",
            "pendientes_en_total": total,
            "pendientes_devueltas": len(filas),
            "pendientes": filas,
        },
        bloques=bloques,
    )


HERRAMIENTAS = [
    Herramienta(
        nombre="alumnos_con_mas_inasistencias",
        descripcion=(
            "Ranking de alumnos con más inasistencias en un período (por defecto, el ciclo hasta "
            "hoy), de toda la institución o de un curso. Opcionales: solo sin justificar y "
            "alumnos con presencia igual o menor a un porcentaje. Cada alumno viene como alias, "
            "sin nombre ni DNI. Para las ausencias de un día puntual usá ausentes_del_dia."
        ),
        parametros=ParametrosAlumnosInasistencias,
        permisos=(PERMISO_ACADEMICO_LEER, PERMISO_FAMILIAS_ALUMNOS_LEER),
        ejecutar=_alumnos_con_mas_inasistencias,
        destino="historial_asistencia",
    ),
    Herramienta(
        nombre="asistencia_por_curso",
        descripcion=(
            "Por curso: cantidad de alumnos inscriptos, inasistencias y presencia en un período "
            "(por defecto, el ciclo hasta hoy). Sirve para '¿cuántos alumnos tiene 2° B y cómo "
            "viene su asistencia?' y '¿qué curso falta más?'. Sin nombres de personas."
        ),
        parametros=ParametrosAsistenciaPorCurso,
        permisos=(PERMISO_ACADEMICO_LEER,),
        ejecutar=_asistencia_por_curso,
        destino="historial_asistencia",
    ),
    Herramienta(
        nombre="resumen_justificaciones",
        descripcion=(
            "Cantidad de justificaciones de inasistencia por estado (pendientes, aprobadas, "
            "rechazadas) o por motivo, de toda la institución o de un curso. Para ver cuáles "
            "son las pendientes usá justificaciones_pendientes."
        ),
        parametros=ParametrosResumenJustificaciones,
        permisos=(PERMISO_ACADEMICO_ACTUALIZAR_JUSTIFICACIONES,),
        ejecutar=_resumen_justificaciones,
    ),
    Herramienta(
        nombre="justificaciones_pendientes",
        descripcion=(
            "Justificaciones de inasistencia que faltan revisar, las que más esperan primero: "
            "alumno (alias), curso, fecha, motivo y días de espera. Para solo la cantidad usá "
            "resumen_justificaciones."
        ),
        parametros=ParametrosJustificacionesPendientes,
        permisos=(PERMISO_ACADEMICO_ACTUALIZAR_JUSTIFICACIONES, PERMISO_FAMILIAS_ALUMNOS_LEER),
        ejecutar=_justificaciones_pendientes,
    ),
]
