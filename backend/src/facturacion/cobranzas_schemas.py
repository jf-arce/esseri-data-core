"""Request/response schemas for the proprietary demo collection file workflow."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

EstadoSeleccion = Literal["pendientes_sin_lote", "en_lote", "todas"]
EstadoLote = Literal["exportado", "en_revision", "pagos_registrados", "liberado"]
EstadoImportacion = Literal["en_revision", "confirmada"]
EstadoDetalle = Literal["listo", "aplicado", "rechazado", "duplicado", "error"]


class FiltrosSeleccion(BaseModel):
    periodo: str | None = Field(default=None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    medio: Literal["cbu", "tarjeta"] | None = None
    estado: EstadoSeleccion | None = None
    buscar: str | None = Field(default=None, max_length=120)


class Seleccion(BaseModel):
    modo: Literal["pagina", "filtrados"]
    factura_ids: list[uuid.UUID] = Field(default_factory=list, max_length=1000)
    filtros: FiltrosSeleccion = Field(default_factory=FiltrosSeleccion)
    excluir_ids: list[uuid.UUID] = Field(default_factory=list, max_length=1000)


class LoteCreate(BaseModel):
    seleccion: Seleccion | None = None
    periodo: str | None = Field(default=None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    factura_ids: list[uuid.UUID] | None = Field(default=None, max_length=500)


class ResumenSeleccionInput(BaseModel):
    seleccion: Seleccion


class RespuestaCreate(BaseModel):
    rechazar_referencias: list[uuid.UUID] = Field(default_factory=list, max_length=500)
    rechazos_cantidad: int | None = Field(default=None, ge=0, le=500)


class ImportacionInput(BaseModel):
    contenido: str = Field(min_length=1, max_length=1024 * 1024)


class ConfirmarImportacionInput(BaseModel):
    importacion_id: uuid.UUID
    revision_confirmada: bool


class LiberarLoteInput(BaseModel):
    motivo: str = Field(min_length=1, max_length=500)
    confirmacion_no_procesado: bool


class ArchivoRead(BaseModel):
    nombre: str
    contenido: str


class DebitoRead(BaseModel):
    referencia: uuid.UUID
    factura_id: uuid.UUID
    numero: str | None = None
    alumno_nombre: str | None = None
    importe: Decimal
    vencimiento: date
    concepto: str
    resultado: str | None
    pago_id: uuid.UUID | None


class FacturaElegibleRead(BaseModel):
    id: uuid.UUID
    numero: str
    alumno_nombre: str
    curso: str
    periodo: str
    medio: str
    fecha_vencimiento: date
    importe: Decimal
    estado: str
    en_lote: bool


class FacturasElegiblesRead(BaseModel):
    items: list[FacturaElegibleRead]
    total: int
    pagina: int
    tamanio: int
    total_pagina: int
    ocultas_en_lote: int


class ResumenMedioRead(BaseModel):
    cantidad: int
    importe: Decimal


class ResumenSeleccionRead(BaseModel):
    cantidad: int
    importe_total: Decimal
    por_medio: dict[str, ResumenMedioRead]
    alcance: Literal["pagina", "filtrados"]
    ocultas_en_lote: int


class LiberacionRead(BaseModel):
    usuario_id: uuid.UUID
    usuario_nombre: str
    fecha: datetime
    motivo: str


class BatchSummaryRead(BaseModel):
    id: uuid.UUID
    codigo: str
    fecha_exportacion: date
    periodo: str
    cantidad_facturas: int
    importe_total: Decimal
    estado: EstadoLote
    resultados_importados: bool
    importacion_id: uuid.UUID | None
    liberacion: LiberacionRead | None


class LoteDetailRead(BatchSummaryRead):
    items: list[DebitoRead]
    solicitudes: list[ArchivoRead]


class HistorialLotesRead(BaseModel):
    items: list[BatchSummaryRead]
    total: int
    pagina: int
    tamanio: int


class LiberacionItemRead(BaseModel):
    lote_id: uuid.UUID
    codigo: str
    cantidad_facturas: int
    usuario_id: uuid.UUID
    usuario_nombre: str
    fecha: datetime
    motivo: str


class LiberacionesRead(BaseModel):
    items: list[LiberacionItemRead]
    total: int
    pagina: int
    tamanio: int


class ImportResumenGrupoRead(BaseModel):
    cantidad: int = 0
    importe: Decimal = Decimal("0.00")


class ImportResumenRead(BaseModel):
    procesados: ImportResumenGrupoRead = Field(default_factory=ImportResumenGrupoRead)
    cobrados: ImportResumenGrupoRead = Field(default_factory=ImportResumenGrupoRead)
    rechazados: ImportResumenGrupoRead = Field(default_factory=ImportResumenGrupoRead)
    errores: ImportResumenGrupoRead = Field(default_factory=ImportResumenGrupoRead)


class ImportDetalleRead(BaseModel):
    linea: int
    referencia: str | None
    factura_id: uuid.UUID | None
    numero_factura: str | None
    alumno_nombre: str | None
    resultado: str | None
    importe: Decimal | None
    estado: EstadoDetalle
    mensaje: str
    pago_id: uuid.UUID | None


class ImportacionRead(BaseModel):
    id: uuid.UUID | None = None
    lote_id: uuid.UUID | None = None
    lote_codigo: str | None = None
    estado: EstadoImportacion | None = None
    archivo_hash: str | None = None
    errores: list[str] = Field(default_factory=list)
    puede_confirmar: bool = False
    resumen: ImportResumenRead = Field(default_factory=ImportResumenRead)
    items: list[ImportDetalleRead] = Field(default_factory=list)
    total: int = 0
    pagina: int = 1
    tamanio: int = 25
