from datetime import time

from pydantic import PositiveInt, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ENVIRONMENT: str = "development"
    DATABASE_URL: str

    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60

    # Bloqueo de POST /auth/login por IP (ver docs/auth-oauth-google.md).
    LOGIN_MAX_INTENTOS: PositiveInt = 10
    LOGIN_VENTANA_MINUTOS: PositiveInt = 15
    LOGIN_BLOQUEO_MINUTOS: PositiveInt = 15

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
    # Cualquier proveedor que hable el protocolo de Chat Completions de OpenAI.
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_TIMEOUT_SEGUNDOS: float = 30.0

    # IA/Sugerencias: umbrales de la detección de patrones por reglas.
    IA_MOROSIDAD_DIAS_VENCIDO: int = 30
    IA_INASISTENCIAS_CANTIDAD: int = 3
    IA_INASISTENCIAS_VENTANA_DIAS: int = 30

    # El job solo decide cuándo ejecutar; cada regla define su propio día de generación.
    FACTURACION_AUTOMATICA_HABILITADA: bool = True
    FACTURACION_HORA_EJECUCION: time = time(hour=0, minute=5)

    # Despachador de Workflows: procesa EVENT_LOG pendientes cada N segundos.
    WORKFLOWS_DESPACHO_HABILITADO: bool = True
    WORKFLOWS_DESPACHO_INTERVALO_SEGUNDOS: int = 30

    # Webhook de n8n que envía los emails de Workflows. Vacío = integración sin configurar.
    N8N_WEBHOOK_URL: str = ""
    N8N_WEBHOOK_TOKEN: str = ""
    # Enable only after the correlated claim/result workflow has been published.
    N8N_MANUAL_HABILITADO: bool = False
    N8N_CALLBACK_BASE_URL: str = "http://backend:8000"
    COMUNICACIONES_ADJUNTOS_HABILITADOS: bool = False
    CLAMAV_HOST: str = ""
    CLAMAV_PORT: int = 3310
    CLAMAV_TIMEOUT_SEGUNDOS: float = 10.0

    # Identidad del mail institucional. El logo tiene que ser una URL pública (Gmail no muestra
    # `data:` ni `localhost`); vacío = el mail lleva solo el nombre de la institución.
    EMAIL_INSTITUCION_NOMBRE: str = "ESSERI"
    EMAIL_INSTITUCION_PIE: str = ""
    EMAIL_LOGO_URL: str = ""

    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    @model_validator(mode="after")
    def _bloqueo_cubre_la_ventana(self) -> "Settings":
        # Si el bloqueo durara menos que la ventana, al vencer podrían quedar fallidos viejos que
        # formen una racha con uno nuevo.
        if self.LOGIN_BLOQUEO_MINUTOS < self.LOGIN_VENTANA_MINUTOS:
            raise ValueError("LOGIN_BLOQUEO_MINUTOS no puede ser menor que LOGIN_VENTANA_MINUTOS")
        return self


settings = Settings()
