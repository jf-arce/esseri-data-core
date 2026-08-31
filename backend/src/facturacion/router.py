import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from src.auth.constants import (
    PERMISO_FACTURACION_ACTUALIZAR,
    PERMISO_FACTURACION_CREAR,
    PERMISO_FACTURACION_ELIMINAR,
    PERMISO_FACTURACION_LEER,
)
from src.auth.dependencies import requiere_permiso
from src.auth.models import Usuario
from src.database import get_db
from src.facturacion import facturas_service, reglas_facturacion_service, service
from src.facturacion.dependencies import obtener_concepto_cobro_o_404, obtener_factura_o_404
from src.facturacion.models import ConceptoCobro, Factura
from src.facturacion.schemas import (
    ConceptoCobroCreate,
    ConceptoCobroRead,
    ConceptoCobroUpdate,
    EjecucionFacturacionRead,
    FacturaCreate,
    FacturaEstado,
    FacturaListadoRead,
    FacturaRead,
    FacturaUpdate,
    GeneracionFacturacionRequest,
    GeneracionFacturacionResumenRead,
    ReglaFacturacionCreate,
    ReglaFacturacionEstadoUpdate,
    ReglaFacturacionRead,
    ReglaFacturacionUpdate,
    ResponsableEconomicoCreate,
    ResponsableEconomicoRead,
)
from src.familias_alumnos.dependencies import obtener_alumno_o_404
from src.familias_alumnos.models import Alumno

router = APIRouter(prefix="/facturacion", tags=["facturacion"])

DbSession = Annotated[Session, Depends(get_db)]
PuedeCrear = Annotated[Usuario, Depends(requiere_permiso(PERMISO_FACTURACION_CREAR))]
PuedeLeer = Annotated[Usuario, Depends(requiere_permiso(PERMISO_FACTURACION_LEER))]
PuedeActualizar = Annotated[Usuario, Depends(requiere_permiso(PERMISO_FACTURACION_ACTUALIZAR))]
PuedeEliminar = Annotated[Usuario, Depends(requiere_permiso(PERMISO_FACTURACION_ELIMINAR))]
ConceptoCobroActual = Annotated[ConceptoCobro, Depends(obtener_concepto_cobro_o_404)]
FacturaActual = Annotated[Factura, Depends(obtener_factura_o_404)]
AlumnoActual = Annotated[Alumno, Depends(obtener_alumno_o_404)]


@router.post("/conceptos", status_code=201)
def crear_concepto_cobro(
    datos: ConceptoCobroCreate, db: DbSession, _: PuedeCrear
) -> ConceptoCobroRead:
    return ConceptoCobroRead.model_validate(service.crear_concepto_cobro(db, datos))


@router.get("/conceptos")
def listar_conceptos_cobro(db: DbSession, _: PuedeLeer) -> list[ConceptoCobroRead]:
    return [
        ConceptoCobroRead.model_validate(concepto)
        for concepto in service.listar_conceptos_cobro(db)
    ]


@router.get("/conceptos/{concepto_id}")
def obtener_concepto_cobro(
    concepto_id: uuid.UUID, _: PuedeLeer, concepto: ConceptoCobroActual
) -> ConceptoCobroRead:
    return ConceptoCobroRead.model_validate(concepto)


@router.put("/conceptos/{concepto_id}")
def actualizar_concepto_cobro(
    concepto_id: uuid.UUID,
    datos: ConceptoCobroUpdate,
    db: DbSession,
    _: PuedeActualizar,
    concepto: ConceptoCobroActual,
) -> ConceptoCobroRead:
    return ConceptoCobroRead.model_validate(service.actualizar_concepto_cobro(db, concepto, datos))


@router.delete("/conceptos/{concepto_id}", status_code=204)
def eliminar_concepto_cobro(
    concepto_id: uuid.UUID,
    db: DbSession,
    _: PuedeEliminar,
    concepto: ConceptoCobroActual,
) -> None:
    service.eliminar_concepto_cobro(db, concepto)


@router.post("/alumnos/{alumno_id}/responsable-economico", status_code=201)
def asignar_responsable_economico(
    datos: ResponsableEconomicoCreate,
    db: DbSession,
    _: PuedeActualizar,
    alumno: AlumnoActual,
) -> ResponsableEconomicoRead:
    responsable = service.asignar_responsable_economico(db, alumno.id, datos)
    return ResponsableEconomicoRead.model_validate(responsable)


@router.get("/alumnos/{alumno_id}/responsable-economico")
def obtener_responsable_economico_actual(
    db: DbSession, _: PuedeLeer, alumno: AlumnoActual
) -> ResponsableEconomicoRead:
    responsable = service.obtener_responsable_economico_actual(db, alumno.id)
    return ResponsableEconomicoRead.model_validate(responsable)


@router.get("/alumnos/{alumno_id}/responsable-economico/historial")
def listar_historial_responsables_economicos(
    db: DbSession, _: PuedeLeer, alumno: AlumnoActual
) -> list[ResponsableEconomicoRead]:
    return [
        ResponsableEconomicoRead.model_validate(responsable)
        for responsable in service.listar_historial_responsables_economicos(db, alumno.id)
    ]


@router.post("/facturas", status_code=201)
def crear_factura(datos: FacturaCreate, db: DbSession, _: PuedeCrear) -> FacturaRead:
    return FacturaRead.model_validate(facturas_service.crear_factura(db, datos))


@router.get("/facturas")
def listar_facturas(
    db: DbSession,
    _: PuedeLeer,
    pagina: Annotated[int, Query(ge=1)] = 1,
    tamanio: Annotated[int, Query(ge=1, le=100)] = 20,
    alumno_id: uuid.UUID | None = None,
    estado: FacturaEstado | None = None,
) -> FacturaListadoRead:
    facturas, total = facturas_service.listar_facturas(
        db, pagina=pagina, tamanio=tamanio, alumno_id=alumno_id, estado=estado
    )
    return FacturaListadoRead(
        items=[FacturaRead.model_validate(factura) for factura in facturas],
        total=total,
        pagina=pagina,
        tamanio=tamanio,
    )


@router.get("/facturas/{factura_id}")
def obtener_factura(_: PuedeLeer, factura: FacturaActual) -> FacturaRead:
    return FacturaRead.model_validate(factura)


@router.put("/facturas/{factura_id}")
def actualizar_factura(
    datos: FacturaUpdate, db: DbSession, _: PuedeActualizar, factura: FacturaActual
) -> FacturaRead:
    return FacturaRead.model_validate(facturas_service.actualizar_factura(db, factura, datos))


@router.delete("/facturas/{factura_id}", status_code=204)
def eliminar_factura(db: DbSession, _: PuedeEliminar, factura: FacturaActual) -> None:
    facturas_service.eliminar_factura(db, factura)


@router.post("/reglas", status_code=201)
def crear_regla_facturacion(
    datos: ReglaFacturacionCreate, db: DbSession, _: PuedeCrear
) -> ReglaFacturacionRead:
    return ReglaFacturacionRead.model_validate(
        reglas_facturacion_service.crear_regla_facturacion(db, datos)
    )


@router.get("/reglas")
def listar_reglas_facturacion(db: DbSession, _: PuedeLeer) -> list[ReglaFacturacionRead]:
    return [
        ReglaFacturacionRead.model_validate(regla)
        for regla in reglas_facturacion_service.listar_reglas_facturacion(db)
    ]


@router.post("/reglas/generaciones/previsualizar")
def previsualizar_generacion_facturacion(
    datos: GeneracionFacturacionRequest, db: DbSession, _: PuedeLeer
) -> GeneracionFacturacionResumenRead:
    plan = reglas_facturacion_service.planificar_generacion_facturacion(db, datos.periodo)
    return reglas_facturacion_service.resumen_plan_generacion(plan)


@router.post("/reglas/generaciones", status_code=201)
def generar_facturacion(
    datos: GeneracionFacturacionRequest, db: DbSession, usuario: PuedeCrear
) -> EjecucionFacturacionRead:
    return reglas_facturacion_service.generar_facturacion(db, datos.periodo, usuario.id)


@router.get("/reglas/generaciones")
def listar_ejecuciones_facturacion(
    db: DbSession,
    _: PuedeLeer,
    limite: Annotated[int, Query(ge=1, le=500)] = 100,
) -> list[EjecucionFacturacionRead]:
    return reglas_facturacion_service.listar_ejecuciones_facturacion(db, limite)


@router.get("/reglas/{regla_id}")
def obtener_regla_facturacion(
    regla_id: uuid.UUID, db: DbSession, _: PuedeLeer
) -> ReglaFacturacionRead:
    return ReglaFacturacionRead.model_validate(
        reglas_facturacion_service.obtener_regla_o_error(db, regla_id)
    )


@router.put("/reglas/{regla_id}")
def actualizar_regla_facturacion(
    regla_id: uuid.UUID, datos: ReglaFacturacionUpdate, db: DbSession, _: PuedeActualizar
) -> ReglaFacturacionRead:
    regla = reglas_facturacion_service.obtener_regla_o_error(db, regla_id)
    return ReglaFacturacionRead.model_validate(
        reglas_facturacion_service.actualizar_regla_facturacion(db, regla, datos)
    )


@router.patch("/reglas/{regla_id}/estado")
def actualizar_estado_regla_facturacion(
    regla_id: uuid.UUID,
    datos: ReglaFacturacionEstadoUpdate,
    db: DbSession,
    _: PuedeActualizar,
) -> ReglaFacturacionRead:
    regla = reglas_facturacion_service.obtener_regla_o_error(db, regla_id)
    return ReglaFacturacionRead.model_validate(
        reglas_facturacion_service.actualizar_estado_regla_facturacion(db, regla, datos)
    )
