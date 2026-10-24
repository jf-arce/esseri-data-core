export type EstadoFactura = 'pendiente' | 'vencida' | 'pagada'
export type EstadoDeudaFamilia = EstadoFactura

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
  alumno_id: string | null
  alumno_nombre: string | null
  alumno_apellido: string | null
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

export interface DetalleFacturaFamilia {
  descripcion: string
  monto: string
}

export interface PagoFamilia {
  id: string
  fecha: string
  monto: string
  estado: PagoFactura['estado']
  metodo_pago: string
  comprobante_disponible: boolean
}

export interface FacturaFamilia {
  id: string
  fecha_emision: string
  fecha_vencimiento: string
  monto_total: string
  estado: EstadoFactura
  alumno_nombre: string
  detalles: DetalleFacturaFamilia[]
  pagos: PagoFamilia[]
}

export interface MovimientoFamilia {
  fecha: string
  tipo: 'debe' | 'haber'
  monto: string
  observacion: string | null
  factura_id: string
}

export interface FacturacionFamilia {
  total_debe: string
  total_haber: string
  saldo: string
  facturas: FacturaFamilia[]
  movimientos: MovimientoFamilia[]
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

export interface DeudaFamilia {
  familia_id: string
  familia_nombre: string
  familia_apellido: string
  familia_dni: string
  monto_pendiente: string
  monto_vencido: string
  monto_pagado: string
  deuda_total: string
  facturas_pendientes: number
  facturas_pagadas: number
  estado: EstadoDeudaFamilia
}

export interface DeudaFamiliasListado {
  items: DeudaFamilia[]
  total: number
  pagina: number
  tamanio: number
}

export interface FiltrosDeudaFamilias {
  pagina: number
  tamanio: number
  estado?: EstadoDeudaFamilia
  buscar?: string
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
  alumnoId?: string
  conceptoCobroId?: string
  ordenarPor?: OrdenarPorFacturas
  direccion?: DireccionOrdenFacturas
}

export type OrdenarPorFacturas = 'fecha_vencimiento' | 'monto_total'
export type DireccionOrdenFacturas = 'asc' | 'desc'

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
  proxima_generacion: string | null
  ultima_ejecucion: UltimaEjecucionReglaFacturacion | null
}

export type ReglaFacturacionPayload = Omit<
  ReglaFacturacion,
  'id' | 'proxima_generacion' | 'ultima_ejecucion'
>

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

export interface UltimaEjecucionReglaFacturacion {
  id: string
  fecha_ejecucion: string
  periodo: string
  origen: ModoGeneracionReglaFacturacion
  estado: EjecucionFacturacion['estado']
  facturas_generadas: number
  cargos_generados: number
  cargos_omitidos: number
  cargos_bloqueados: number
  error_detalle: string | null
}

export interface ReglaPenalidad {
  id: string
  desde_dia_vencido: number
  hasta_dia_vencido: number | null
  porcentaje: string
  concepto_cobro_id: string
  activo: boolean
  created_at: string
  updated_at: string
}

export interface ReglaPenalidadPayload {
  desde_dia_vencido: number
  hasta_dia_vencido: number | null
  porcentaje: string
  concepto_cobro_id: string
}

export interface ExcepcionVencimiento {
  id: string
  familia_id: string
  fecha_vencimiento_excepcional: string
  motivo: string | null
  created_at: string
  usuario_id: string
  anulada_at: string | null
  usuario_anulacion_id: string | null
}

export interface ExcepcionVencimientoPayload {
  fecha_vencimiento_excepcional: string
  motivo: string
}
