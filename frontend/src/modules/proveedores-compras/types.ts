// Espeja `ProveedorResponse`/`ProveedorCreate`/`ProveedorUpdate` de
// `backend/src/proveedores_compras/schemas.py`. Los campos van en snake_case porque es lo que
// devuelve la API tal cual, sin capa de mapeo.

export type EstadoProveedor = 'activo' | 'inactivo'

export interface Proveedor {
  id: string
  nombre: string
  categoria: string | null
  telefono: string | null
  email: string | null
  estado: EstadoProveedor
  created_at: string
  updated_at: string
}

export interface CrearProveedorPayload {
  nombre: string
  categoria?: string | null
  telefono?: string | null
  email?: string | null
  estado: EstadoProveedor
}

// Todos opcionales: el backend aplica solo lo que venga informado (`exclude_unset`).
export type ActualizarProveedorPayload = Partial<CrearProveedorPayload>

export type OrdenProveedores = 'nombre-asc' | 'nombre-desc' | 'categoria-asc'

// --- Solicitudes internas de compra (RF-20) -------------------------------------------------
// Espeja los schemas de `SolicitudCompra` en el backend.

export type EstadoSolicitud = 'pendiente' | 'aprobada' | 'rechazada'

export interface SolicitudCompra {
  id: string
  articulo: string | null
  producto_servicio_id: string | null
  cantidad: number
  area_solicitante: string | null
  estado: EstadoSolicitud
  fecha: string
  usuario_id: string
  updated_at: string
}

// `usuario_id` no va: el backend lo toma de la sesion, no del payload.
export interface CrearSolicitudPayload {
  articulo?: string | null
  producto_servicio_id?: string | null
  cantidad: number
  area_solicitante?: string | null
  fecha?: string | null
}

// El estado no entra aca: cambiarlo es una decision de negocio y tiene su propio endpoint.
export type ActualizarSolicitudPayload = Partial<CrearSolicitudPayload>

export type OrdenSolicitudes = 'fecha-desc' | 'fecha-asc' | 'cantidad-desc'

// --- Catalogo de productos y servicios ------------------------------------------------------

export type TipoProductoServicio = 'producto' | 'servicio'

export interface ProductoServicio {
  id: string
  nombre: string
  categoria: string | null
  unidad: string | null
  tipo: TipoProductoServicio
  activo: boolean
  created_at: string
  updated_at: string
}

export interface CrearProductoPayload {
  nombre: string
  categoria?: string | null
  unidad?: string | null
  tipo: TipoProductoServicio
  activo: boolean
}

export type ActualizarProductoPayload = Partial<CrearProductoPayload>

export type OrdenProductos = 'nombre-asc' | 'nombre-desc' | 'categoria-asc'

// --- Ordenes de compra (RF-21) --------------------------------------------------------------

export type EstadoOrdenCompra = 'emitida' | 'recibida' | 'cancelada'

export interface OrdenCompraDetalle {
  id: string
  producto_servicio_id: string
  cantidad_pedida: string
}

export interface OrdenCompra {
  id: string
  fecha: string
  estado: EstadoOrdenCompra
  proveedor_id: string
  updated_at: string
  detalles: OrdenCompraDetalle[]
  solicitud_ids: string[]
}

export interface CrearOrdenDetallePayload {
  producto_servicio_id: string
  cantidad_pedida: string
}

export interface CrearOrdenPayload {
  proveedor_id: string
  fecha?: string | null
  solicitud_ids: string[]
  detalles: CrearOrdenDetallePayload[]
}

export type OrdenOrdenes = 'fecha-desc' | 'fecha-asc'

// --- Recepcion de compras (issue #111) ------------------------------------------------------

export type TipoRecepcion = 'total' | 'parcial'

// `cantidad_pendiente` no es columna en la base: la calcula el backend como
// cantidad_pedida - SUM(cantidad_recibida). Llega ya resuelta.
export interface LineaPendiente {
  orden_compra_detalle_id: string
  producto_servicio_id: string
  cantidad_pedida: string
  cantidad_recibida: string
  cantidad_pendiente: string
}

export interface RecepcionDetalle {
  id: string
  orden_compra_detalle_id: string
  cantidad_recibida: string
}

export interface Recepcion {
  id: string
  fecha: string
  tipo: TipoRecepcion
  remito: string | null
  observaciones: string | null
  orden_compra_id: string
  usuario_id: string
  updated_at: string
  detalles: RecepcionDetalle[]
}

// Ni `tipo` ni `usuario_id` van: el backend los deriva de las cantidades y de la sesion.
export interface CrearRecepcionPayload {
  fecha?: string | null
  remito?: string | null
  observaciones?: string | null
  detalles: { orden_compra_detalle_id: string; cantidad_recibida: string }[]
}
