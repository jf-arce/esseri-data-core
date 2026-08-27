"""Excepciones de negocio del módulo de inscripciones."""

from src.exceptions import AppException


class InscripcionNoEncontrada(AppException):
    status_code = 404


class ConflictoInscripcion(AppException):
    status_code = 409


class InscripcionInvalida(AppException):
    status_code = 422
