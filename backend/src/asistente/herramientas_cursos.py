"""Cursos: estructura (niveles, años, divisiones), horarios, alumnos y docentes de un curso.

Las personas salen como alias (`[ALUMNO:n]`, `[DOCENTE:n]`): el proveedor no ve nombres.
"""

from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.academico.horarios_service import DIAS_SEMANA, etiqueta_division
from src.academico.models import (
    Anio,
    AsignacionDocente,
    Division,
    Docente,
    HorarioMateriaCurso,
    Materia,
    MateriaCurso,
    NivelEducativo,
)
from src.asistente.constants import TIPO_ALIAS_ALUMNO, TIPO_ALIAS_DOCENTE
from src.asistente.herramientas_base import (
    ContextoHerramienta,
    Herramienta,
    ResultadoHerramienta,
    bloque_tabla,
)
from src.asistente.seudonimos_service import obtener_o_crear_alias
from src.auth.constants import PERMISO_ACADEMICO_LEER, PERMISO_FAMILIAS_ALUMNOS_LEER
from src.familias_alumnos.models import Alumno
from src.inscripciones.models import Inscripcion
from src.models import Persona
from src.search import normalizar_texto_busqueda

_MAX_FILAS = 80
_NUMERO_DE_DIA = {
    normalizar_texto_busqueda(nombre): numero_dia for numero_dia, nombre in DIAS_SEMANA.items()
}


class ParametrosCurso(BaseModel):
    nivel: str | None = Field(
        default=None, description="Nivel educativo, por ejemplo Inicial, Primario o Secundario."
    )
    anio: int | None = Field(default=None, ge=1, le=12, description="Año o grado (1, 2, 3...).")
    division: str | None = Field(
        default=None, description="División, por ejemplo A o B. Si falta, todas las del año."
    )


def _divisiones(db: Session, parametros: ParametrosCurso) -> list[Division]:
    """Divisiones que cumplen el filtro, ordenadas por nivel, año y nombre."""
    consulta = (
        select(Division)
        .join(Anio, Anio.id == Division.anio_id)
        .join(NivelEducativo, NivelEducativo.id == Anio.nivel_educativo_id)
        .order_by(NivelEducativo.nombre, Anio.numero, Division.nombre)
    )
    if parametros.nivel is not None:
        consulta = consulta.where(
            NivelEducativo.nombre.icontains(parametros.nivel, autoescape=True)
        )
    if parametros.anio is not None:
        consulta = consulta.where(Anio.numero == parametros.anio)
    divisiones = list(db.scalars(consulta))
    if parametros.division is None:
        return divisiones
    pedida = normalizar_texto_busqueda(parametros.division)
    return [
        d
        for d in divisiones
        if pedida
        in {
            normalizar_texto_busqueda(d.nombre),
            normalizar_texto_busqueda(etiqueta_division(d)).replace(" ", ""),
        }
    ]


def _filtros_academico(divisiones: list[Division]) -> dict[str, str]:
    """Nivel, año y división con los que abrir Académico, solo los que son únicos en la consulta."""
    filtros: dict[str, str] = {}
    niveles = {d.anio.nivel_educativo_id for d in divisiones}
    if len(niveles) == 1:
        filtros["nivel"] = str(next(iter(niveles)))
    anios = {d.anio_id for d in divisiones}
    if len(anios) == 1:
        filtros["anio"] = str(next(iter(anios)))
    if len(divisiones) == 1:
        filtros["division"] = str(divisiones[0].id)
    return filtros


def _sin_curso(
    mensaje: str = "No hay un curso que coincida con ese filtro.",
) -> ResultadoHerramienta:
    return ResultadoHerramienta(para_llm={"error": mensaje})


# --- Estructura -----------------------------------------------------------------------------


class ParametrosEstructura(ParametrosCurso):
    ciclo_lectivo: str | None = Field(
        default=None, description="Año del ciclo lectivo. Si falta, el seleccionado en pantalla."
    )


def _estructura_academica(
    contexto: ContextoHerramienta, parametros: ParametrosEstructura
) -> ResultadoHerramienta:
    ciclo = parametros.ciclo_lectivo or contexto.ciclo_lectivo
    divisiones = _divisiones(contexto.db, parametros)
    if not divisiones:
        return _sin_curso()
    ids = [d.id for d in divisiones]
    alumnos = dict(
        contexto.db.execute(
            select(Inscripcion.division_id, func.count(Inscripcion.id))
            .where(
                Inscripcion.division_id.in_(ids),
                Inscripcion.ciclo_lectivo == ciclo,
                Inscripcion.estado == "activa",
            )
            .group_by(Inscripcion.division_id)
        ).all()
    )
    materias = dict(
        contexto.db.execute(
            select(MateriaCurso.division_id, func.count(MateriaCurso.id))
            .where(MateriaCurso.division_id.in_(ids))
            .group_by(MateriaCurso.division_id)
        ).all()
    )
    filas = [
        {
            "nivel": d.anio.nivel_educativo.nombre,
            "curso": etiqueta_division(d),
            "alumnos": alumnos.get(d.id, 0),
            "materias": materias.get(d.id, 0),
        }
        for d in divisiones[:_MAX_FILAS]
    ]
    periodo = f"ciclo lectivo {ciclo}"
    fuente = "Estructura académica e inscripciones activas"
    tabla = bloque_tabla(
        "Cursos",
        [
            {"clave": "nivel", "etiqueta": "Nivel", "tipo": "texto"},
            {"clave": "curso", "etiqueta": "Curso", "tipo": "texto"},
            {"clave": "alumnos", "etiqueta": "Alumnos", "tipo": "numero"},
            {"clave": "materias", "etiqueta": "Materias", "tipo": "numero"},
        ],
        filas,
        periodo=periodo,
        fuente=fuente,
    )
    return ResultadoHerramienta(
        para_llm={
            "periodo": periodo,
            "fuente": fuente,
            "cursos": filas,
            "total_cursos": len(divisiones),
            "total_alumnos": sum(f["alumnos"] for f in filas),
            "truncado": len(divisiones) > _MAX_FILAS,
        },
        bloques=[tabla],
        filtros_destino=_filtros_academico(divisiones),
    )


# --- Horarios ---------------------------------------------------------------------------------


class ParametrosHorario(ParametrosCurso):
    dia: str | None = Field(
        default=None, description="Día de la semana (lunes a domingo). Si falta, toda la semana."
    )


def _horario_del_curso(
    contexto: ContextoHerramienta, parametros: ParametrosHorario
) -> ResultadoHerramienta:
    if parametros.nivel is None and parametros.anio is None:
        return _sin_curso("Indicá al menos el nivel o el año.")
    dia = None
    if parametros.dia is not None:
        dia = _NUMERO_DE_DIA.get(normalizar_texto_busqueda(parametros.dia))
        if dia is None:
            return _sin_curso("Día inválido: usá lunes a domingo.")

    divisiones = {d.id: d for d in _divisiones(contexto.db, parametros)}
    consulta = (
        select(
            MateriaCurso.division_id,
            Materia.nombre,
            HorarioMateriaCurso.dia_semana,
            HorarioMateriaCurso.hora_inicio,
            HorarioMateriaCurso.hora_fin,
        )
        .join(Materia, Materia.id == MateriaCurso.materia_id)
        .join(HorarioMateriaCurso, HorarioMateriaCurso.materia_curso_id == MateriaCurso.id)
        .where(MateriaCurso.division_id.in_(list(divisiones)))
    )
    if dia is not None:
        consulta = consulta.where(HorarioMateriaCurso.dia_semana == dia)
    franjas = sorted(
        (
            (etiqueta_division(divisiones[division_id]), dia_semana, desde, materia, hasta)
            for division_id, materia, dia_semana, desde, hasta in contexto.db.execute(consulta)
        ),
        key=lambda f: (f[0], f[1], f[2]),
    )
    if not franjas:
        return _sin_curso("No hay horarios cargados para ese curso o día.")

    filas = [
        {
            "curso": etiqueta,
            "dia": DIAS_SEMANA[dia_semana].capitalize(),
            "desde": f"{desde:%H:%M}",
            "hasta": f"{hasta:%H:%M}",
            "materia": materia,
        }
        for etiqueta, dia_semana, desde, materia, hasta in franjas[:_MAX_FILAS]
    ]
    fuente = "Horarios por curso (Académico)"
    tabla = bloque_tabla(
        "Horario por curso",
        [
            {"clave": "curso", "etiqueta": "Curso", "tipo": "texto"},
            {"clave": "dia", "etiqueta": "Día", "tipo": "texto"},
            {"clave": "desde", "etiqueta": "Desde", "tipo": "texto"},
            {"clave": "hasta", "etiqueta": "Hasta", "tipo": "texto"},
            {"clave": "materia", "etiqueta": "Materia", "tipo": "texto"},
        ],
        filas,
        periodo="Horario semanal",
        fuente=fuente,
    )
    return ResultadoHerramienta(
        para_llm={"fuente": fuente, "franjas": filas, "truncado": len(franjas) > _MAX_FILAS},
        bloques=[tabla],
        filtros_destino=_filtros_academico(list(divisiones.values())),
    )


# --- Alumnos del curso -----------------------------------------------------------------------


class ParametrosAlumnosDelCurso(ParametrosEstructura):
    pass


def _alumnos_del_curso(
    contexto: ContextoHerramienta, parametros: ParametrosAlumnosDelCurso
) -> ResultadoHerramienta:
    if parametros.nivel is None and parametros.anio is None:
        return _sin_curso("Indicá al menos el nivel o el año.")
    ciclo = parametros.ciclo_lectivo or contexto.ciclo_lectivo
    divisiones = {d.id: d for d in _divisiones(contexto.db, parametros)}
    if not divisiones:
        return _sin_curso()
    consulta = (
        select(Inscripcion.division_id, Inscripcion.alumno_id)
        .join(Alumno, Alumno.id == Inscripcion.alumno_id)
        .join(Persona, Persona.id == Alumno.persona_id)
        .where(
            Inscripcion.division_id.in_(list(divisiones)),
            Inscripcion.ciclo_lectivo == ciclo,
            Inscripcion.estado == "activa",
        )
        .order_by(Inscripcion.division_id, Persona.apellido, Persona.nombre)
    )
    inscriptos = contexto.db.execute(consulta).all()
    if not inscriptos:
        return _sin_curso("No hay alumnos inscriptos activos en ese curso.")

    tope = min(_MAX_FILAS, contexto.max_filas * 3)
    filas = [
        {
            "alumno": obtener_o_crear_alias(
                contexto.db, contexto.conversacion_id, TIPO_ALIAS_ALUMNO, alumno_id
            ),
            "curso": etiqueta_division(divisiones[division_id]),
        }
        for division_id, alumno_id in inscriptos[:tope]
    ]
    periodo = f"ciclo lectivo {ciclo}"
    fuente = "Inscripciones activas"
    tabla = bloque_tabla(
        "Alumnos del curso",
        [
            {"clave": "alumno", "etiqueta": "Alumno", "tipo": "alias"},
            {"clave": "curso", "etiqueta": "Curso", "tipo": "texto"},
        ],
        filas,
        periodo=periodo,
        fuente=fuente,
    )
    return ResultadoHerramienta(
        para_llm={
            "periodo": periodo,
            "fuente": fuente,
            "total_alumnos": len(inscriptos),
            "alumnos": filas,
            "truncado": len(inscriptos) > tope,
        },
        bloques=[tabla],
        filtros_destino=_filtros_academico(list(divisiones.values())),
    )


# --- Docentes del curso ----------------------------------------------------------------------


class ParametrosDocentesDelCurso(ParametrosEstructura):
    materia: str | None = Field(
        default=None, description="Nombre de la materia, si se pregunta por una en particular."
    )


def _docentes_del_curso(
    contexto: ContextoHerramienta, parametros: ParametrosDocentesDelCurso
) -> ResultadoHerramienta:
    if parametros.nivel is None and parametros.anio is None and parametros.materia is None:
        return _sin_curso("Indicá al menos el nivel, el año o la materia.")
    ciclo = parametros.ciclo_lectivo or contexto.ciclo_lectivo
    divisiones = {d.id: d for d in _divisiones(contexto.db, parametros)}
    if not divisiones:
        return _sin_curso()
    consulta = (
        select(MateriaCurso.division_id, Materia.nombre, Docente.id)
        .select_from(AsignacionDocente)
        .join(MateriaCurso, MateriaCurso.id == AsignacionDocente.materia_curso_id)
        .join(Materia, Materia.id == MateriaCurso.materia_id)
        .join(Docente, Docente.id == AsignacionDocente.docente_id)
        .join(Persona, Persona.id == Docente.persona_id)
        .where(
            MateriaCurso.division_id.in_(list(divisiones)),
            AsignacionDocente.ciclo_lectivo == ciclo,
        )
        .order_by(Materia.nombre, Persona.apellido, Persona.nombre)
    )
    if parametros.materia is not None:
        consulta = consulta.where(Materia.nombre.icontains(parametros.materia, autoescape=True))
    asignaciones = contexto.db.execute(consulta).all()
    if not asignaciones:
        return _sin_curso("No hay docentes asignados a ese curso o materia.")

    filas = [
        {
            "docente": obtener_o_crear_alias(
                contexto.db, contexto.conversacion_id, TIPO_ALIAS_DOCENTE, docente_id
            ),
            "materia": materia,
            "curso": etiqueta_division(divisiones[division_id]),
        }
        for division_id, materia, docente_id in asignaciones[:_MAX_FILAS]
    ]
    periodo = f"ciclo lectivo {ciclo}"
    fuente = "Asignaciones docentes"
    tabla = bloque_tabla(
        "Docentes del curso",
        [
            {"clave": "docente", "etiqueta": "Docente", "tipo": "alias"},
            {"clave": "materia", "etiqueta": "Materia", "tipo": "texto"},
            {"clave": "curso", "etiqueta": "Curso", "tipo": "texto"},
        ],
        filas,
        periodo=periodo,
        fuente=fuente,
    )
    return ResultadoHerramienta(
        para_llm={
            "periodo": periodo,
            "fuente": fuente,
            "docentes": filas,
            "truncado": len(asignaciones) > _MAX_FILAS,
        },
        bloques=[tabla],
    )


HERRAMIENTAS = [
    Herramienta(
        nombre="estructura_academica",
        descripcion=(
            "Niveles, años y divisiones (cursos) con la cantidad de alumnos inscriptos y de "
            "materias de cada uno. Sin nombres de personas."
        ),
        parametros=ParametrosEstructura,
        permisos=(PERMISO_ACADEMICO_LEER,),
        ejecutar=_estructura_academica,
        destino="academico",
    ),
    Herramienta(
        nombre="horario_del_curso",
        descripcion=(
            "Materias y horarios semanales de un curso: por nivel, año, división y día. Sirve "
            "para '¿qué materias tiene 1° A los miércoles?'. Sin docentes."
        ),
        parametros=ParametrosHorario,
        permisos=(PERMISO_ACADEMICO_LEER,),
        ejecutar=_horario_del_curso,
        destino="academico",
    ),
    Herramienta(
        nombre="alumnos_del_curso",
        descripcion=(
            "Alumnos inscriptos (activos) en un curso o año, cada uno como alias, sin nombre ni "
            "DNI. Para solo la cantidad usá estructura_academica."
        ),
        parametros=ParametrosAlumnosDelCurso,
        permisos=(PERMISO_ACADEMICO_LEER, PERMISO_FAMILIAS_ALUMNOS_LEER),
        ejecutar=_alumnos_del_curso,
        destino="academico",
    ),
    Herramienta(
        nombre="docentes_del_curso",
        descripcion=(
            "Docentes asignados a las materias de un curso o año (o a una materia puntual), cada "
            "uno como alias, sin nombre ni contacto."
        ),
        parametros=ParametrosDocentesDelCurso,
        permisos=(PERMISO_ACADEMICO_LEER,),
        ejecutar=_docentes_del_curso,
        destino="asignaciones_docentes",
    ),
]
