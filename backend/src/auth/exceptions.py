from src.exceptions import AppException


class CredencialesInvalidas(AppException):
    status_code = 401

    def __init__(self, message: str = "Credenciales inválidas"):
        super().__init__(message)


class TokenInvalido(AppException):
    status_code = 401

    def __init__(self, message: str = "Token inválido o expirado"):
        super().__init__(message)


class UsuarioNoHabilitado(AppException):
    """Google confirmó la identidad, pero esa persona no está cargada en el sistema.

    No es un 401: su login sí funcionó. Decirle "credenciales inválidas" la mandaría a revisar su
    cuenta de Google, que no es donde está el problema.
    """

    status_code = 403

    def __init__(
        self,
        message: str = (
            "Tu cuenta de Google es válida pero no está habilitada en ESSERI. "
            "Contactá a administración."
        ),
    ):
        super().__init__(message)


class UsuarioInactivo(AppException):
    status_code = 403

    def __init__(self, message: str = "Tu cuenta está inactiva"):
        super().__init__(message)


class EstadoOAuthInvalido(AppException):
    """El `state` que volvió de Google no coincide con el que emitimos (posible CSRF)."""

    status_code = 400

    def __init__(self, message: str = "La sesión de login expiró o no es válida"):
        super().__init__(message)


class LoginCancelado(AppException):
    """El usuario canceló el consentimiento en la pantalla de Google (no llegó `code`)."""

    status_code = 400

    def __init__(self, message: str = "Cancelaste el inicio de sesión con Google"):
        super().__init__(message)
