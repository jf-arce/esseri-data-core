export type EstadoFactura = 'pendiente' | 'vencida' | 'pagada'

export interface ConceptoCobro {
  id: string
  nombre: string
  categoria: string | null
  activo: boolean
}

export interface DetalleFactura {
  id: string
  descripcion: string
  monto: string
  concepto_cobro_id: string
}

export interface Factura {
  id: string
  fecha_emision: string
  fecha_vencimiento: string
  monto_total: string
  estado: EstadoFactura
  updated_at: string
  inscripcion_id: string
  responsable_economico_id: string
  detalles: DetalleFactura[]
}

export interface MetodoPago {
  id: string
  nombre: string
  requiere_comprobante: boolean
}

export interface PagoFactura {
  id: string
  fecha: string
  monto: string
  comprobante: string | null
  estado: 'aprobado' | 'rechazado' | 'pendiente'
  referencia_transaccion: string | null
  fecha_operacion: string | null
  registrado_por: string | null
  metodo_pago: MetodoPago
}

export interface FacturaDetalle extends Factura {
  alumno_nombre: string
  alumno_legajo: string
  responsable_economico_nombre: string | null
  pagos: PagoFactura[]
}

export interface RegistrarPagoPayload {
  fecha: string
  monto: string
  metodo_pago_id: string
  referencia_transaccion?: string
  comprobante?: File
}

export interface FacturasListado {
  items: Factura[]
  total: number
  pagina: number
  tamanio: number
}

export interface CrearFacturaPayload {
  fecha_emision: string
  fecha_vencimiento: string
  inscripcion_id: string
  detalles: Array<{
    descripcion: string
    monto: string
    concepto_cobro_id: string
  }>
}

export interface FiltrosFacturas {
  pagina: number
  tamanio: number
  estado?: EstadoFactura
  buscar?: string
}

export type PeriodicidadReglaFacturacion = 'mensual' | 'anual'
export type CriterioAplicacionReglaFacturacion =
  'todas_inscripciones' | 'nivel' | 'anio' | 'division'
export type EstadoReglaFacturacion = 'borrador' | 'activa' | 'pausada' | 'finalizada'
export type ModoGeneracionReglaFacturacion = 'manual' | 'automatica'

export interface ReglaFacturacion {
  id: string
  nombre: string
  descripcion: string | null
  ciclo_lectivo: string
  concepto_cobro_id: string
  importe: string
  periodicidad: PeriodicidadReglaFacturacion
  vigencia_desde: string
  vigencia_hasta: string
  mes_aplicacion: number | null
  modo_generacion: ModoGeneracionReglaFacturacion
  dia_generacion: number | null
  dia_vencimiento: number
  criterio_aplicacion: CriterioAplicacionReglaFacturacion
  nivel_educativo_id: string | null
  anio_id: string | null
  division_id: string | null
  estado: EstadoReglaFacturacion
}

export type ReglaFacturacionPayload = Omit<ReglaFacturacion, 'id'>

export interface ResumenGeneracionFacturacion {
  periodo: string
  reglas_aplicables: number
  alumnos_alcanzados: number
  cargos_aptos: number
  cargos_omitidos: number
  cargos_bloqueados: number
  monto_estimado: string
}

export interface EjecucionFacturacion extends ResumenGeneracionFacturacion {
  id: string
  fecha_ejecucion: string
  facturas_generadas: number
  cargos_generados: number
  monto_total: string
  origen: ModoGeneracionReglaFacturacion
  estado: 'exitosa' | 'parcial' | 'fallida'
  error_detalle: string | null
  regla_ids: string[]
}
