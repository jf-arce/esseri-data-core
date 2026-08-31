from src.exceptions import AppException


class NivelEducativoConAnios(AppException):
    """El nivel educativo tiene años asociados: borrarlo dejaría ANIO apuntando a nada."""

    status_code = 409

    def __init__(
        self,
        message: str = "No se puede eliminar: el nivel educativo tiene años asociados",
    ):
        super().__init__(message)


class AnioConDivisiones(AppException):
    """El año tiene divisiones asociadas: borrarlo dejaría DIVISION apuntando a nada."""

    status_code = 409

    def __init__(
        self,
        message: str = "No se puede eliminar: el año tiene divisiones asociadas",
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


class NombreNivelDuplicado(AppException):
    """Ya existe un nivel educativo con ese nombre."""

    status_code = 409

    def __init__(self, message: str = "Ya existe un nivel educativo con ese nombre"):
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
    """Ya existe una materia con ese nombre para ese año y división."""

    status_code = 409

    def __init__(
        self,
        message: str = "Ya existe una materia con ese nombre para ese año y división",
    ):
        super().__init__(message)


class MateriaConAsignaciones(AppException):
    """La materia tiene asignaciones docentes asociadas."""

    status_code = 409

    def __init__(
        self,
        message: str = "No se puede eliminar: la materia tiene asignaciones docentes",
    ):
        super().__init__(message)


class LegajoDuplicado(AppException):
    """Ya existe un docente con ese legajo."""

    status_code = 409

    def __init__(self, message: str = "Ya existe un docente con ese legajo"):
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
    """Ya existe una asignación para ese docente, materia, división y ciclo lectivo."""

    status_code = 409

    def __init__(
        self,
        message: str = (
            "Ya existe una asignación para ese docente, materia, división y ciclo lectivo"
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
