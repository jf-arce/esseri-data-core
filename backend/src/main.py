from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.academico.router import router as academico_router
from src.auditoria.router import router as auditoria_router
from src.auth.router import router as auth_router
from src.config import settings
from src.exceptions import AppException, app_exception_handler
from src.facturacion.router import router as facturacion_router
from src.familias_alumnos.router import router as familias_alumnos_router
from src.ia_sugerencias.router import router as ia_sugerencias_router
from src.inscripciones.router import router as inscripciones_router
from src.panel_admin.router import router as panel_admin_router
from src.proveedores_compras.router import router as proveedores_compras_router
from src.workflows.router import router as workflows_router

app = FastAPI(title="ESSERI Data Core API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(AppException, app_exception_handler)

app.include_router(auth_router)
app.include_router(familias_alumnos_router)
app.include_router(academico_router)
app.include_router(inscripciones_router)
app.include_router(facturacion_router)
app.include_router(proveedores_compras_router)
app.include_router(workflows_router)
app.include_router(auditoria_router)
app.include_router(panel_admin_router)
app.include_router(ia_sugerencias_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
