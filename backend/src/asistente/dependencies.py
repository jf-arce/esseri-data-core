"""Dependencias HTTP del Asistente."""

from dataclasses import dataclass
from typing import Annotated

import httpx
from fastapi import Depends

from src.asistente.exceptions import AsistenteDeshabilitado
from src.auth.constants import PERMISO_ASISTENTE_LEER
from src.auth.dependencies import RolActivo, requiere_permiso
from src.auth.exceptions import PermisoDenegado
from src.auth.models import Usuario
from src.config import settings


def exigir_habilitado() -> None:
    """Interruptor del lado del backend: con `ASISTENTE_HABILITADO=false` todo responde 503."""
    if not settings.ASISTENTE_HABILITADO:
        raise AsistenteDeshabilitado()


@dataclass(frozen=True)
class SesionAsistente:
    usuario: Usuario
    rol_codigo: str


def obtener_sesion(
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ASISTENTE_LEER))],
    rol_activo: RolActivo,
) -> SesionAsistente:
    if rol_activo is None:
        raise PermisoDenegado("Elegí con qué rol entrar antes de continuar")
    return SesionAsistente(usuario=usuario, rol_codigo=rol_activo)


Sesion = Annotated[SesionAsistente, Depends(obtener_sesion)]


def obtener_transport_proveedor() -> httpx.BaseTransport | None:
    """Los tests lo reemplazan por un `MockTransport`; en producción es el transporte normal."""
    return None


TransportProveedor = Annotated[httpx.BaseTransport | None, Depends(obtener_transport_proveedor)]
