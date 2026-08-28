"""Parámetros de configuración propios de auth (JWT y Google), leídos de src.config.settings."""

from src.config import settings

JWT_SECRET = settings.JWT_SECRET
JWT_ALGORITHM = settings.JWT_ALGORITHM
JWT_EXPIRE_MINUTES = settings.JWT_EXPIRE_MINUTES

GOOGLE_CLIENT_ID = settings.GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET = settings.GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI = settings.GOOGLE_REDIRECT_URI

FRONTEND_URL = settings.FRONTEND_URL

# Nombres de las cookies que emite el módulo.
COOKIE_SESION = "access_token"
COOKIE_OAUTH_STATE = "oauth_state"

# La cookie de state/PKCE solo tiene que sobrevivir el viaje de ida y vuelta a Google.
OAUTH_STATE_EXPIRE_SECONDS = 300

# En desarrollo el navegador habla con el backend por http, así que Secure no puede ir siempre.
COOKIE_SECURE = settings.ENVIRONMENT != "development"
