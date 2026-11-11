from src.exceptions import AppException


class AnioConDivisiones(AppException):
    """El año tiene divisiones asociadas: borrarlo dejaría DIVISION apuntando a nada."""

    status_code = 409

    def __init__(
        self,
        message: str = "No se puede eliminar: el año tiene divisiones asociadas",
    ):
        super().__init__(message)


class AnioConMaterias(AppException):
    """El año tiene materias asignadas a sus divisiones: borrarlo dejaría referencias colgando."""

    status_code = 409

    def __init__(
        self,
        message: str = "No se puede eliminar: el año tiene materias asignadas a sus divisiones",
    ):
        super().__init__(message)


class DivisionConMaterias(AppException):
    """La división tiene materias asignadas: borrarla dejaría referencias colgando."""

    status_code = 409

    def __init__(
        self,
        message: str = "No se puede eliminar: la división tiene materias asignadas",
    ):
        super().__init__(message)


class DivisionConInscripciones(AppException):
    """La división tiene alumnos inscriptos: borrarla dejaría INSCRIPCION apuntando a nada."""

    status_code = 409

    def __init__(
        self,
        message: str = "No se puede eliminar: la división tiene alumnos inscriptos",
    ):
        super().__init__(message)


class MateriaCursoDuplicada(AppException):
    """La materia ya está asignada a ese curso."""

    status_code = 409

    def __init__(
        self,
        message: str = "Esa materia ya está asignada a esta división",
    ):
        super().__init__(message)


class DivisionConAsignaciones(AppException):
    """La división tiene asignaciones docentes: borrarla dejaría referencias colgando."""

    status_code = 409

    def __init__(
        self,
        message: str = "No se puede eliminar: la división tiene asignaciones docentes",
    ):
        super().__init__(message)


class AnioDuplicado(AppException):
    """Ya existe un año con ese número para ese nivel educativo."""

    status_code = 409

    def __init__(
        self,
        message: str = "Ya existe un año con ese número para ese nivel educativo",
    ):
        super().__init__(message)


class DivisionDuplicada(AppException):
    """Ya existe una división con ese nombre para ese año."""

    status_code = 409

    def __init__(self, message: str = "Ya existe una división con ese nombre para ese año"):
        super().__init__(message)


class MateriaDuplicada(AppException):
    """Ya existe una materia con ese nombre en el catálogo."""

    status_code = 409

    def __init__(
        self,
        message: str = "Ya existe una materia con ese nombre",
    ):
        super().__init__(message)


class MateriaConCursos(AppException):
    """La materia del catálogo está asignada a uno o más cursos."""

    status_code = 409

    def __init__(
        self,
        message: str = "No se puede eliminar: la materia está asignada a una o más divisiones",
    ):
        super().__init__(message)


class MateriaCursoConAsignaciones(AppException):
    """La materia del curso tiene docentes asignados."""

    status_code = 409

    def __init__(
        self,
        message: str = "No se puede eliminar: la materia tiene docentes asignados",
    ):
        super().__init__(message)


class HorarioDuplicado(AppException):
    """Hay dos franjas horarias que se pisan dentro de la misma materia del curso."""

    status_code = 409

    def __init__(
        self,
        message: str = "Hay franjas horarias superpuestas para esta materia",
    ):
        super().__init__(message)


class DocenteConHorarioSuperpuesto(AppException):
    """El docente ya dicta otra materia en una franja que se pisa con la nueva."""

    status_code = 409

    def __init__(self, message: str):
        super().__init__(message)


class HorarioSuperpuestoEnDivision(AppException):
    """Otra materia de la misma división ya ocupa parte de esa franja."""

    status_code = 409

    def __init__(self, message: str):
        super().__init__(message)


class LegajoDuplicado(AppException):
    """Ya existe un docente con ese legajo."""

    status_code = 409

    def __init__(self, message: str = "Ya existe un docente con ese legajo"):
        super().__init__(message)


class CuentaSinPersona(AppException):
    """La cuenta no tiene `persona_id`: no hay a quién engancharle la ficha Docente."""

    status_code = 409

    def __init__(self, message: str = "Esa cuenta no tiene una persona asociada"):
        super().__init__(message)


class DocenteConAsignaciones(AppException):
    """El docente tiene asignaciones docentes asociadas."""

    status_code = 409

    def __init__(
        self,
        message: str = "No se puede eliminar: el docente tiene asignaciones docentes",
    ):
        super().__init__(message)


class AsignacionDocenteDuplicada(AppException):
    """Ya existe una asignación para ese docente, materia de curso y ciclo lectivo."""

    status_code = 409

    def __init__(
        self,
        message: str = (
            "Ya existe una asignación para ese docente, materia de curso y ciclo lectivo"
        ),
    ):
        super().__init__(message)


class AsistenciaDuplicada(AppException):
    """Ya existe un registro de asistencia para esa inscripción en esa fecha."""

    status_code = 409

    def __init__(
        self,
        message: str = ("Ya existe un registro de asistencia para esa inscripción en esa fecha"),
    ):
        super().__init__(message)


class AsistenciaYaJustificada(AppException):
    """La asistencia ya fue justificada y no puede modificarse desde el registro docente."""

    status_code = 409

    def __init__(
        self,
        message: str = (
            "La asistencia ya fue justificada y no puede modificarse desde el registro docente"
        ),
    ):
        super().__init__(message)


class InscripcionNoActiva(AppException):
    """La inscripción no está activa, no se puede registrar asistencia."""

    status_code = 409

    def __init__(
        self,
        message: str = "La inscripción no está activa, no se puede registrar asistencia",
    ):
        super().__init__(message)
