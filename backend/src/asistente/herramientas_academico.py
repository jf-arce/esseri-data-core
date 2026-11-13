"""Inscripciones, asistencias y ficha de alumno."""

from datetime import date, timedelta
from typing import Literal

from pydantic import BaseModel, Field
from sqlalchemy import func, select

from src.academico.models import Anio, Division, NivelEducativo
from src.asistente.constants import TIPO_ALIAS_ALUMNO
from src.asistente.herramientas_base import (
    ContextoHerramienta,
    Herramienta,
    ResultadoHerramienta,
    bloque_kpi,
    bloque_tabla,
    bloque_tarjeta,
    fecha_ar,
    mes_ar,
    numero,
    porcentaje,
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

_MAX_DIAS_TENDENCIA = 366
_MAX_DIAS_POR_DIA = 62


class ParametrosCiclo(BaseModel):
    ciclo_lectivo: str | None = Field(
        default=None, description="Año del ciclo lectivo. Si falta, el seleccionado en pantalla."
    )


def _resumen_inscripciones(
    contexto: ContextoHerramienta, parametros: ParametrosCiclo
) -> ResultadoHerramienta:
    ciclo = parametros.ciclo_lectivo or contexto.ciclo_lectivo
    por_tipo_estado = contexto.db.execute(
        select(Inscripcion.tipo, Inscripcion.estado, func.count(Inscripcion.id))
        .where(Inscripcion.ciclo_lectivo == ciclo)
        .group_by(Inscripcion.tipo, Inscripcion.estado)
        .order_by(Inscripcion.tipo, Inscripcion.estado)
    ).all()
    admisiones = contexto.db.execute(
        select(SolicitudInscripcion.etapa, func.count(SolicitudInscripcion.id))
        .where(
            SolicitudInscripcion.ciclo_lectivo == ciclo,
            SolicitudInscripcion.estado == "en_proceso",
        )
        .group_by(SolicitudInscripcion.etapa)
        .order_by(SolicitudInscripcion.etapa)
    ).all()
    filas_inscripciones = [
        {"tipo": tipo, "estado": estado, "cantidad": cantidad}
        for tipo, estado, cantidad in por_tipo_estado
    ]
    filas_admisiones = [{"etapa": etapa, "cantidad": cantidad} for etapa, cantidad in admisiones]
    periodo = f"ciclo lectivo {ciclo}"
    fuente = "Inscripciones"
    return ResultadoHerramienta(
        para_llm={
            "periodo": periodo,
            "fuente": fuente,
            "inscripciones": filas_inscripciones,
            "admisiones_en_proceso_por_etapa": filas_admisiones,
        },
        bloques=[
            bloque_tabla(
                "Inscripciones por tipo y estado",
                [
                    {"clave": "tipo", "etiqueta": "Tipo", "tipo": "texto"},
                    {"clave": "estado", "etiqueta": "Estado", "tipo": "texto"},
                    {"clave": "cantidad", "etiqueta": "Cantidad", "tipo": "numero"},
                ],
                filas_inscripciones,
                periodo=periodo,
                fuente=fuente,
            ),
            bloque_tabla(
                "Admisiones en proceso por etapa",
                [
                    {"clave": "etapa", "etiqueta": "Etapa", "tipo": "texto"},
                    {"clave": "cantidad", "etiqueta": "Cantidad", "tipo": "numero"},
                ],
                filas_admisiones,
                periodo=periodo,
                fuente=fuente,
            ),
        ],
    )


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


def _clave_periodo(dia: date, agrupar_por: str) -> str:
    if agrupar_por == "dia":
        return fecha_ar(dia)
    if agrupar_por == "mes":
        return mes_ar(dia.year, dia.month)
    lunes = dia - timedelta(days=dia.weekday())
    return f"semana del {fecha_ar(lunes)}"


def _tendencia_asistencias(
    contexto: ContextoHerramienta, parametros: ParametrosTendencia
) -> ResultadoHerramienta:
    ciclo = parametros.ciclo_lectivo or contexto.ciclo_lectivo
    hasta = parametros.hasta or contexto.hoy
    desde = parametros.desde or hasta - timedelta(days=30)
    if desde > hasta or (hasta - desde).days > _MAX_DIAS_TENDENCIA:
        return ResultadoHerramienta(
            para_llm={"error": "El período es inválido o supera un año. Pedí uno más corto."}
        )
    if parametros.agrupar_por == "dia" and (hasta - desde).days >= _MAX_DIAS_POR_DIA:
        return ResultadoHerramienta(
            para_llm={
                "error": "Por día solo se pueden pedir hasta 62 días. Agrupá por semana o mes."
            }
        )
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
            _clave_periodo(dia, parametros.agrupar_por),
            {"registros": 0, "presentes": 0, "tardanzas": 0, "ausentes": 0},
        )
        dia += timedelta(days=1)
    for fecha, tipo, cantidad in registros:
        acumulado = periodos[_clave_periodo(fecha, parametros.agrupar_por)]
        acumulado["registros"] += cantidad
        if tipo == "presente":
            acumulado["presentes"] += cantidad
        elif tipo == "tardanza":
            acumulado["tardanzas"] += cantidad
        else:
            acumulado["ausentes"] += cantidad

    filas = [
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
    periodo = f"{fecha_ar(desde)} a {fecha_ar(hasta)}, ciclo {ciclo}"
    fuente = "Asistencias (Inscripciones)"
    return ResultadoHerramienta(
        para_llm={
            "periodo": periodo,
            "fuente": fuente,
            "criterio": "la tardanza cuenta como presencia; presencia null = sin registros",
            "periodos": filas,
        },
        bloques=[
            bloque_tabla(
                "Asistencia por período",
                [
                    {"clave": "periodo", "etiqueta": "Período", "tipo": "texto"},
                    {"clave": "registros", "etiqueta": "Registros", "tipo": "numero"},
                    {"clave": "presentes", "etiqueta": "Presentes", "tipo": "numero"},
                    {"clave": "tardanzas", "etiqueta": "Tardanzas", "tipo": "numero"},
                    {"clave": "ausentes", "etiqueta": "Ausentes", "tipo": "numero"},
                    {
                        "clave": "porcentaje_presencia",
                        "etiqueta": "Presencia",
                        "tipo": "porcentaje",
                    },
                ],
                filas,
                periodo=periodo,
                fuente=fuente,
            )
        ],
    )


_TIPOS_AUSENTE = ("ausente_pendiente", "ausente_justificado", "ausente_injustificado")


class ParametrosAusentes(BaseModel):
    fecha: date | None = Field(default=None, description="Día, AAAA-MM-DD. Por defecto, hoy.")
    limite: int = Field(default=20, ge=1, le=100, description="Cuántos alumnos devolver.")


def _ausentes_del_dia(
    contexto: ContextoHerramienta, parametros: ParametrosAusentes
) -> ResultadoHerramienta:
    dia = parametros.fecha or contexto.hoy
    limite = min(parametros.limite, contexto.max_filas)
    condiciones = (Asistencia.fecha == dia, Asistencia.tipo.in_(_TIPOS_AUSENTE))
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
    return ResultadoHerramienta(
        para_llm={
            "periodo": periodo,
            "fuente": fuente,
            "ausentes_en_total": total,
            "alumnos_devueltos": len(filas),
            "ausentes": filas,
        },
        bloques=[
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
            )
        ],
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
    ),
    Herramienta(
        nombre="ausentes_del_dia",
        descripcion=(
            "Alumnos ausentes en un día puntual, hoy o pasado (también 'ayer'), con curso y "
            "tipo de ausencia. Cada alumno viene como alias, sin nombre ni DNI. Para solo la "
            "cantidad usá tendencia_asistencias."
        ),
        parametros=ParametrosAusentes,
        permisos=(PERMISO_ACADEMICO_LEER, PERMISO_FAMILIAS_ALUMNOS_LEER),
        ejecutar=_ausentes_del_dia,
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
