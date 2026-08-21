"""Parámetros de configuración propios de auth (JWT), leídos de src.config.settings."""

from src.config import settings

JWT_SECRET = settings.JWT_SECRET
JWT_ALGORITHM = settings.JWT_ALGORITHM
JWT_EXPIRE_MINUTES = settings.JWT_EXPIRE_MINUTES
