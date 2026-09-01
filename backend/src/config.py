from datetime import time

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ENVIRONMENT: str = "development"
    DATABASE_URL: str

    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60

    # Google Identity/OAuth (RF-27). El secret solo vive acá, nunca en el frontend.
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/auth/google/callback"

    # A dónde vuelve el navegador después del callback de Google.
    FRONTEND_URL: str = "http://localhost:5173"

    # Primer superadmin (ver database/seeds/00_bootstrap_admin.py).
    BOOTSTRAP_ADMIN_EMAIL: str = ""
    BOOTSTRAP_ADMIN_PASSWORD: str = ""

    OPENAI_API_KEY: str = ""

    # El job solo decide cuándo ejecutar; cada regla define su propio día de generación.
    FACTURACION_AUTOMATICA_HABILITADA: bool = True
    FACTURACION_HORA_EJECUCION: time = time(hour=0, minute=5)

    CORS_ORIGINS: list[str] = ["http://localhost:5173"]


settings = Settings()
