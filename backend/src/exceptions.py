from fastapi import Request
from fastapi.responses import JSONResponse


class AppException(Exception):
    """Excepción base de la aplicación. Las excepciones propias de cada
    módulo (`src/<modulo>/exceptions.py`) heredan de esta."""

    status_code = 400

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})
