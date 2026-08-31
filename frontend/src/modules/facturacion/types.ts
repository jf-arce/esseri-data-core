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
}
