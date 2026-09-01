"""Modelos Pydantic: forma de los datos que entran y salen por la API de este módulo."""

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def _normalizar_instante_utc(value: datetime | None) -> datetime | None:
    """Mantiene compatibilidad con filas históricas sin zona y serializa siempre UTC."""

    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


class ConceptoCobroBase(BaseModel):
    """Datos configurables de un concepto facturable."""

    nombre: str = Field(min_length=1, max_length=150)
    categoria: str | None = Field(default=None, max_length=100)

    @field_validator("nombre", "categoria", mode="before")
    @classmethod
    def normalizar_texto(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class ConceptoCobroCreate(ConceptoCobroBase):
    """Datos para incorporar un concepto al catálogo."""

    activo: bool = True


class ConceptoCobroUpdate(BaseModel):
    """Campos editables de un concepto; permite darlo de baja con `activo = false`."""

    nombre: str | None = Field(default=None, min_length=1, max_length=150)
    categoria: str | None = Field(default=None, max_length=100)
    activo: bool | None = None

    @field_validator("nombre", "categoria", mode="before")
    @classmethod
    def normalizar_texto(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class ConceptoCobroRead(ConceptoCobroBase):
    """Concepto de cobro expuesto por la API."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    activo: bool
    created_at: datetime
    updated_at: datetime

    _normalizar_timestamps = field_validator("created_at", "updated_at")(_normalizar_instante_utc)


class ResponsableEconomicoCreate(BaseModel):
    """Solicitud para designar o cambiar el responsable económico de un alumno."""

    familia_id: uuid.UUID
    fecha_solicitud_cambio: date


class ResponsableEconomicoRead(BaseModel):
    """Responsable económico de un alumno durante un período determinado."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    vigencia_desde: date
    vigencia_hasta: date | None
    fecha_solicitud_cambio: date | None
    alumno_id: uuid.UUID
    familia_id: uuid.UUID
    updated_at: datetime

    _normalizar_timestamps = field_validator("updated_at")(_normalizar_instante_utc)


FacturaEstado = Literal["pendiente", "vencida", "pagada"]


class DetalleFacturaCreate(BaseModel):
    descripcion: str = Field(min_length=1, max_length=250)
    monto: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    concepto_cobro_id: uuid.UUID

    @field_validator("descripcion")
    @classmethod
    def normalizar_descripcion(cls, value: str) -> str:
        return value.strip()


class FacturaCreate(BaseModel):
    fecha_emision: date
    fecha_vencimiento: date
    inscripcion_id: uuid.UUID
    detalles: list[DetalleFacturaCreate] = Field(min_length=1)

    @model_validator(mode="after")
    def validar_fechas(self) -> "FacturaCreate":
        if self.fecha_vencimiento < self.fecha_emision:
            raise ValueError("La fecha de vencimiento no puede ser anterior a la emisión.")
        return self


class FacturaUpdate(BaseModel):
    fecha_vencimiento: date | None = None
    detalles: list[DetalleFacturaCreate] | None = Field(default=None, min_length=1)


class DetalleFacturaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    descripcion: str
    monto: Decimal
    concepto_cobro_id: uuid.UUID


class FacturaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    fecha_emision: date
    fecha_vencimiento: date
    monto_total: Decimal
    estado: FacturaEstado
    updated_at: datetime
    inscripcion_id: uuid.UUID
    responsable_economico_id: uuid.UUID
    alumno_id: uuid.UUID | None = None
    alumno_nombre: str | None = None
    alumno_apellido: str | None = None
    detalles: list[DetalleFacturaRead]

    _normalizar_timestamps = field_validator("updated_at")(_normalizar_instante_utc)


class FacturaListadoRead(BaseModel):
    items: list[FacturaRead]
    total: int
    pagina: int
    tamanio: int


class MetodoPagoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nombre: str
    requiere_comprobante: bool


class PagoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    fecha: date
    monto: Decimal
    comprobante: str | None
    estado: Literal["aprobado", "rechazado", "pendiente"]
    referencia_transaccion: str | None
    fecha_operacion: datetime | None
    registrado_por: str | None
    metodo_pago: MetodoPagoRead

    _normalizar_timestamps = field_validator("fecha_operacion")(_normalizar_instante_utc)


class FacturaDetalleRead(FacturaRead):
    alumno_nombre: str
    alumno_legajo: str
    responsable_economico_nombre: str | None
    pagos: list[PagoRead]


PeriodicidadReglaFacturacion = Literal["mensual", "anual"]
CriterioAplicacionReglaFacturacion = Literal["todas_inscripciones", "nivel", "anio", "division"]
EstadoReglaFacturacion = Literal["borrador", "activa", "pausada", "finalizada"]
ModoGeneracionReglaFacturacion = Literal["manual", "automatica"]


class ReglaFacturacionBase(BaseModel):
    nombre: str = Field(min_length=1, max_length=150)
    descripcion: str | None = Field(default=None, max_length=500)
    ciclo_lectivo: str = Field(pattern=r"^[1-9]\d{3}$")
    concepto_cobro_id: uuid.UUID
    importe: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    periodicidad: PeriodicidadReglaFacturacion
    vigencia_desde: date
    vigencia_hasta: date
    mes_aplicacion: int | None = Field(default=None, ge=1, le=12)
    modo_generacion: ModoGeneracionReglaFacturacion = "manual"
    dia_generacion: int | None = Field(default=None, ge=1, le=31)
    dia_vencimiento: int = Field(ge=1, le=31)
    criterio_aplicacion: CriterioAplicacionReglaFacturacion
    nivel_educativo_id: uuid.UUID | None = None
    anio_id: uuid.UUID | None = None
    division_id: uuid.UUID | None = None

    @field_validator("nombre", "descripcion", mode="before")
    @classmethod
    def normalizar_texto(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def validar_regla(self) -> "ReglaFacturacionBase":
        if self.vigencia_hasta < self.vigencia_desde:
            raise ValueError("La vigencia hasta no puede ser anterior a la vigencia desde.")
        ciclo = int(self.ciclo_lectivo)
        if self.vigencia_desde.year != ciclo or self.vigencia_hasta.year != ciclo:
            raise ValueError("La vigencia debe pertenecer al ciclo lectivo indicado.")
        if self.periodicidad == "anual" and self.mes_aplicacion is None:
            raise ValueError("Una regla anual requiere mes de aplicación.")
        if self.periodicidad == "mensual" and self.mes_aplicacion is not None:
            raise ValueError("Una regla mensual no debe indicar un mes de aplicación.")
        if self.modo_generacion == "automatica" and self.dia_generacion is None:
            raise ValueError("Una regla automática requiere día de generación.")
        if self.modo_generacion == "manual" and self.dia_generacion is not None:
            raise ValueError("Una regla manual no debe indicar día de generación.")
        if self.dia_generacion is not None and self.dia_generacion > self.dia_vencimiento:
            raise ValueError("El día de generación no puede ser posterior al vencimiento.")

        destinos = {
            "nivel": self.nivel_educativo_id,
            "anio": self.anio_id,
            "division": self.division_id,
        }
        if self.criterio_aplicacion == "todas_inscripciones":
            if any(destinos.values()):
                raise ValueError("El criterio todas_inscripciones no admite un destino específico.")
        elif destinos[self.criterio_aplicacion] is None:
            raise ValueError("El criterio de aplicación requiere seleccionar su destino.")
        elif any(
            valor is not None
            for clave, valor in destinos.items()
            if clave != self.criterio_aplicacion
        ):
            raise ValueError("Solo puede indicarse el destino correspondiente al criterio elegido.")
        return self


class ReglaFacturacionCreate(ReglaFacturacionBase):
    estado: EstadoReglaFacturacion = "borrador"


class ReglaFacturacionUpdate(ReglaFacturacionBase):
    pass


class ReglaFacturacionEstadoUpdate(BaseModel):
    estado: EstadoReglaFacturacion


class ReglaFacturacionRead(ReglaFacturacionBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    estado: EstadoReglaFacturacion
    created_at: datetime
    updated_at: datetime
    proxima_generacion: date | None = None
    ultima_ejecucion: "UltimaEjecucionReglaRead | None" = None

    _normalizar_timestamps = field_validator("created_at", "updated_at")(_normalizar_instante_utc)


class GeneracionFacturacionRequest(BaseModel):
    periodo: date

    @field_validator("periodo")
    @classmethod
    def validar_inicio_periodo(cls, value: date) -> date:
        if value.day != 1:
            raise ValueError("El período debe indicarse con el primer día del mes.")
        return value


class GeneracionFacturacionResumenRead(BaseModel):
    periodo: date
    reglas_aplicables: int
    alumnos_alcanzados: int
    cargos_aptos: int
    cargos_omitidos: int
    cargos_bloqueados: int
    monto_estimado: Decimal


class EjecucionFacturacionRead(GeneracionFacturacionResumenRead):
    id: uuid.UUID
    fecha_ejecucion: datetime
    facturas_generadas: int
    cargos_generados: int
    monto_total: Decimal
    origen: Literal["manual", "automatica"]
    estado: Literal["exitosa", "parcial", "fallida"]
    error_detalle: str | None
    regla_ids: list[uuid.UUID]

    _normalizar_timestamps = field_validator("fecha_ejecucion")(_normalizar_instante_utc)


class UltimaEjecucionReglaRead(BaseModel):
    """Último intento ligado a una regla, incluido si terminó parcial o fallido."""

    id: uuid.UUID
    fecha_ejecucion: datetime
    periodo: date
    origen: Literal["manual", "automatica"]
    estado: Literal["exitosa", "parcial", "fallida"]
    facturas_generadas: int
    cargos_generados: int
    cargos_omitidos: int
    cargos_bloqueados: int
    error_detalle: str | None

    _normalizar_timestamps = field_validator("fecha_ejecucion")(_normalizar_instante_utc)
