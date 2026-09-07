import uuid
from datetime import date
from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile
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
    DetalleFacturaRead,
    EjecucionFacturacionRead,
    FacturaCreate,
    FacturaDetalleRead,
    FacturaEstado,
    FacturaListadoRead,
    FacturaRead,
    FacturaUpdate,
    GeneracionFacturacionRequest,
    GeneracionFacturacionResumenRead,
    MetodoPagoRead,
    PagoRead,
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


def _factura_detalle_read(db: Session, factura: Factura) -> FacturaDetalleRead:
    alumno = facturas_service.obtener_alumno_factura(db, factura)
    responsable = facturas_service.obtener_responsable_factura(db, factura)
    if alumno is None:
        raise HTTPException(status_code=409, detail="La factura no tiene un alumno asociado.")
    return FacturaDetalleRead(
        id=factura.id,
        fecha_emision=factura.fecha_emision,
        fecha_vencimiento=factura.fecha_vencimiento,
        monto_total=factura.monto_total,
        estado=factura.estado,
        updated_at=factura.updated_at,
        inscripcion_id=factura.inscripcion_id,
        responsable_economico_id=factura.responsable_economico_id,
        detalles=[DetalleFacturaRead.model_validate(detalle) for detalle in factura.detalles],
        alumno_nombre=f"{alumno.persona.apellido}, {alumno.persona.nombre}",
        alumno_legajo=alumno.numero_legajo,
        responsable_economico_nombre=(
            f"{responsable.persona.apellido}, {responsable.persona.nombre}"
            if responsable is not None
            else None
        ),
        pagos=[PagoRead.model_validate(pago) for pago in factura.pagos],
    )


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
    concepto_cobro_id: uuid.UUID | None = None,
    estado: FacturaEstado | None = None,
    buscar: Annotated[str | None, Query(max_length=100)] = None,
    ordenar_por: Literal["fecha_vencimiento", "monto_total"] = "fecha_vencimiento",
    direccion: Literal["asc", "desc"] = "asc",
) -> FacturaListadoRead:
    facturas, total = facturas_service.listar_facturas(
        db,
        pagina=pagina,
        tamanio=tamanio,
        alumno_id=alumno_id,
        concepto_cobro_id=concepto_cobro_id,
        estado=estado,
        buscar=buscar,
        ordenar_por=ordenar_por,
        direccion=direccion,
    )
    return FacturaListadoRead(
        items=[FacturaRead.model_validate(factura) for factura in facturas],
        total=total,
        pagina=pagina,
        tamanio=tamanio,
    )


@router.get("/metodos-pago")
def listar_metodos_pago(db: DbSession, _: PuedeLeer) -> list[MetodoPagoRead]:
    return [
        MetodoPagoRead.model_validate(metodo) for metodo in facturas_service.listar_metodos_pago(db)
    ]


@router.get("/facturas/{factura_id}/pdf")
def descargar_factura_pdf(db: DbSession, _: PuedeLeer, factura: FacturaActual) -> Response:
    alumno = facturas_service.obtener_alumno_factura(db, factura)
    if alumno is None:
        raise HTTPException(status_code=409, detail="La factura no tiene un alumno asociado.")
    contenido = facturas_service.generar_pdf_factura(factura, alumno)
    return Response(
        content=contenido,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="factura-{str(factura.id)[:8]}.pdf"'
        },
    )


@router.post("/facturas/{factura_id}/pagos", status_code=201)
def registrar_pago(
    db: DbSession,
    usuario: PuedeCrear,
    factura: FacturaActual,
    fecha: Annotated[date, Form()],
    monto: Annotated[Decimal, Form(gt=0, max_digits=12, decimal_places=2)],
    metodo_pago_id: Annotated[uuid.UUID, Form()],
    referencia_transaccion: Annotated[str | None, Form(max_length=120)] = None,
    comprobante: Annotated[UploadFile | None, File()] = None,
) -> PagoRead:
    contenido = comprobante.file.read() if comprobante is not None else None
    pago = facturas_service.registrar_pago(
        db,
        factura=factura,
        usuario_registro_id=usuario.id,
        fecha=fecha,
        monto=monto,
        metodo_pago_id=metodo_pago_id,
        referencia_transaccion=referencia_transaccion,
        comprobante_nombre=comprobante.filename if comprobante is not None else None,
        comprobante_tipo_contenido=comprobante.content_type if comprobante is not None else None,
        comprobante_contenido=contenido,
    )
    return PagoRead.model_validate(pago)


@router.get("/pagos/{pago_id}/comprobante")
def descargar_comprobante_pago(pago_id: uuid.UUID, db: DbSession, _: PuedeLeer) -> Response:
    archivo = facturas_service.obtener_comprobante_pago(db, pago_id)
    if archivo is None:
        raise HTTPException(status_code=404, detail="El pago no tiene comprobante adjunto.")
    return Response(
        content=archivo.contenido,
        media_type=archivo.tipo_contenido,
        headers={"Content-Disposition": f'attachment; filename="{archivo.nombre}"'},
    )


@router.get("/facturas/{factura_id}")
def obtener_factura(db: DbSession, _: PuedeLeer, factura: FacturaActual) -> FacturaDetalleRead:
    return _factura_detalle_read(db, factura)


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
    return reglas_facturacion_service.regla_facturacion_read(
        db, reglas_facturacion_service.crear_regla_facturacion(db, datos)
    )


@router.get("/reglas")
def listar_reglas_facturacion(db: DbSession, _: PuedeLeer) -> list[ReglaFacturacionRead]:
    return reglas_facturacion_service.listar_reglas_facturacion_read(db)


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
    return reglas_facturacion_service.regla_facturacion_read(
        db, reglas_facturacion_service.obtener_regla_o_error(db, regla_id)
    )


@router.put("/reglas/{regla_id}")
def actualizar_regla_facturacion(
    regla_id: uuid.UUID, datos: ReglaFacturacionUpdate, db: DbSession, _: PuedeActualizar
) -> ReglaFacturacionRead:
    regla = reglas_facturacion_service.obtener_regla_o_error(db, regla_id)
    return reglas_facturacion_service.regla_facturacion_read(
        db, reglas_facturacion_service.actualizar_regla_facturacion(db, regla, datos)
    )


@router.patch("/reglas/{regla_id}/estado")
def actualizar_estado_regla_facturacion(
    regla_id: uuid.UUID,
    datos: ReglaFacturacionEstadoUpdate,
    db: DbSession,
    _: PuedeActualizar,
) -> ReglaFacturacionRead:
    regla = reglas_facturacion_service.obtener_regla_o_error(db, regla_id)
    return reglas_facturacion_service.regla_facturacion_read(
        db, reglas_facturacion_service.actualizar_estado_regla_facturacion(db, regla, datos)
    )
