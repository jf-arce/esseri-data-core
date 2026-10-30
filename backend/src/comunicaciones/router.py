import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from src.auth.constants import (
    PERMISO_COMUNICACIONES_ACTUALIZAR,
    PERMISO_COMUNICACIONES_ACTUALIZAR_DOCENTE,
    PERMISO_COMUNICACIONES_CREAR,
    PERMISO_COMUNICACIONES_CREAR_DOCENTE,
    PERMISO_COMUNICACIONES_LEER,
    PERMISO_COMUNICACIONES_LEER_DOCENTE,
)
from src.auth.dependencies import DbSession, RolActivo, requiere_permiso
from src.auth.models import Usuario
from src.comunicaciones import service
from src.comunicaciones.schemas import BorradorInput, ComunicacionRead, Listado

router = APIRouter(prefix="/comunicaciones", tags=["Comunicaciones"])
Crear = Annotated[Usuario, Depends(requiere_permiso(PERMISO_COMUNICACIONES_CREAR))]
Editar = Annotated[Usuario, Depends(requiere_permiso(PERMISO_COMUNICACIONES_ACTUALIZAR))]
Leer = Annotated[Usuario, Depends(requiere_permiso(PERMISO_COMUNICACIONES_LEER))]
CrearDocente = Annotated[Usuario, Depends(requiere_permiso(PERMISO_COMUNICACIONES_CREAR_DOCENTE))]
EditarDocente = Annotated[
    Usuario, Depends(requiere_permiso(PERMISO_COMUNICACIONES_ACTUALIZAR_DOCENTE))
]
LeerDocente = Annotated[Usuario, Depends(requiere_permiso(PERMISO_COMUNICACIONES_LEER_DOCENTE))]


def gestion(rol: str | None):
    if rol == "familia":
        raise HTTPException(403, "Usá tu bandeja familiar")
    if rol == "docente" or (rol or "").startswith("docente_"):
        raise HTTPException(403, "Usá el portal correspondiente")


def solo_docente(rol: str | None):
    if rol != "docente" and not (rol or "").startswith("docente_"):
        raise HTTPException(403, "Esta operación requiere el rol Docente")


def familiar(rol: str | None, response: Response):
    response.headers["Cache-Control"] = "private, no-store"
    if rol != "familia":
        raise HTTPException(403, "Esta operación requiere el rol Familia")


@router.get("/familia")
def bandeja(
    db: DbSession,
    usuario: Leer,
    rol: RolActivo,
    response: Response,
    pagina: Annotated[int, Query(ge=1)] = 1,
    buscar: Annotated[str, Query(max_length=200)] = "",
    no_leidas: bool = False,
) -> Listado:
    familiar(rol, response)
    return service.listar(db, usuario, pagina, buscar, no_leidas, familia=True)


@router.get("/familia/{id}")
def detalle(
    id: uuid.UUID, db: DbSession, usuario: Leer, rol: RolActivo, response: Response
) -> ComunicacionRead:
    familiar(rol, response)
    return service.detalle_familia(db, id, usuario)


@router.put("/familia/{id}/lectura")
def lectura(
    id: uuid.UUID, db: DbSession, usuario: Leer, rol: RolActivo, response: Response
) -> ComunicacionRead:
    familiar(rol, response)
    return service.detalle_familia(db, id, usuario, leer=True)


@router.get("/docente/opciones")
def opciones_docente(
    db: DbSession,
    usuario: LeerDocente,
    rol: RolActivo,
    ciclo_lectivo: Annotated[str, Query(pattern=r"^\d{4}$")],
):
    solo_docente(rol)
    return service.opciones_docente(db, usuario, ciclo_lectivo)


@router.post("/docente/vista-previa")
def vista_previa_docente(data: BorradorInput, db: DbSession, usuario: CrearDocente, rol: RolActivo):
    solo_docente(rol)
    service.validar_curso(db, usuario, data.audiencia)
    return {"destinatarios": len(service.resolver(db, data.audiencia))}


@router.get("/docente")
def listado_docente(
    db: DbSession,
    usuario: LeerDocente,
    rol: RolActivo,
    pagina: Annotated[int, Query(ge=1)] = 1,
    buscar: Annotated[str, Query(max_length=200)] = "",
) -> Listado:
    solo_docente(rol)
    return service.listar(db, usuario, pagina, buscar, False, tipo="curso", autor_id=usuario.id)


@router.post("/docente", status_code=201)
def crear_docente(
    data: BorradorInput, db: DbSession, usuario: CrearDocente, rol: RolActivo
) -> ComunicacionRead:
    solo_docente(rol)
    return service.crear(db, data, usuario, tipo="curso")


@router.get("/docente/{id}")
def obtener_docente(
    id: uuid.UUID, db: DbSession, usuario: LeerDocente, rol: RolActivo
) -> ComunicacionRead:
    solo_docente(rol)
    return service.respuesta(db, service.obtener(db, id, usuario, tipo="curso"))


@router.put("/docente/{id}")
def editar_docente(
    id: uuid.UUID,
    data: BorradorInput,
    db: DbSession,
    usuario: EditarDocente,
    rol: RolActivo,
) -> ComunicacionRead:
    solo_docente(rol)
    return service.editar(db, id, data, usuario, tipo="curso")


@router.post("/docente/{id}/publicar")
def publicar_docente(
    id: uuid.UUID, db: DbSession, usuario: CrearDocente, rol: RolActivo
) -> ComunicacionRead:
    solo_docente(rol)
    return service.publicar(db, id, usuario, tipo="curso")


@router.get("/opciones")
def opciones(db: DbSession, _: Crear, rol: RolActivo):
    gestion(rol)
    return service.opciones(db)


@router.post("/vista-previa")
def vista_previa(data: BorradorInput, db: DbSession, _: Crear, rol: RolActivo):
    gestion(rol)
    return {"destinatarios": len(service.resolver(db, data.audiencia))}


@router.get("")
def listado(
    db: DbSession,
    usuario: Leer,
    rol: RolActivo,
    pagina: Annotated[int, Query(ge=1)] = 1,
    buscar: Annotated[str, Query(max_length=200)] = "",
) -> Listado:
    gestion(rol)
    return service.listar(db, usuario, pagina, buscar, False)


@router.post("", status_code=201)
def crear(data: BorradorInput, db: DbSession, usuario: Crear, rol: RolActivo) -> ComunicacionRead:
    gestion(rol)
    return service.crear(db, data, usuario, tipo="institucional")


@router.get("/{id}")
def obtener(id: uuid.UUID, db: DbSession, usuario: Leer, rol: RolActivo) -> ComunicacionRead:
    gestion(rol)
    return service.respuesta(db, service.obtener(db, id, usuario))


@router.put("/{id}")
def editar(
    id: uuid.UUID, data: BorradorInput, db: DbSession, usuario: Editar, rol: RolActivo
) -> ComunicacionRead:
    gestion(rol)
    return service.editar(db, id, data, usuario, tipo="institucional")


@router.post("/{id}/publicar")
def publicar(id: uuid.UUID, db: DbSession, usuario: Crear, rol: RolActivo) -> ComunicacionRead:
    gestion(rol)
    return service.publicar(db, id, usuario, tipo="institucional")


@router.get("/docente/{id}/envios")
def envios_docente(id: uuid.UUID, db: DbSession, usuario: LeerDocente, rol: RolActivo):
    from src.workflows.manuales_service import historial

    solo_docente(rol)
    service.obtener(db, id, usuario, tipo="curso")
    return historial(db, id)


@router.get("/{id}/envios")
def envios(id: uuid.UUID, db: DbSession, usuario: Leer, rol: RolActivo):
    from src.workflows.manuales_service import historial

    gestion(rol)
    service.obtener(db, id, usuario)
    return historial(db, id)


@router.post("/docente/{id}/envios/{envio_id}/reintentar")
def reintento_docente(
    id: uuid.UUID, envio_id: uuid.UUID, db: DbSession, usuario: CrearDocente, rol: RolActivo
):
    from src.workflows.manuales_service import reintentar

    solo_docente(rol)
    c = service.obtener(db, id, usuario, tipo="curso")
    service.validar_curso(db, usuario, service.Audiencia.model_validate(c.audiencia))
    return reintentar(db, id, envio_id)


@router.post("/{id}/envios/{envio_id}/reintentar")
def reintento(id: uuid.UUID, envio_id: uuid.UUID, db: DbSession, usuario: Crear, rol: RolActivo):
    from src.workflows.manuales_service import reintentar

    gestion(rol)
    service.obtener(db, id, usuario)
    return reintentar(db, id, envio_id)
