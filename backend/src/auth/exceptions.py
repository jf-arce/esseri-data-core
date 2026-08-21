from src.exceptions import AppException


class CredencialesInvalidas(AppException):
    status_code = 401

    def __init__(self, message: str = "Credenciales inválidas"):
        super().__init__(message)


class TokenInvalido(AppException):
    status_code = 401

    def __init__(self, message: str = "Token inválido o expirado"):
        super().__init__(message)
