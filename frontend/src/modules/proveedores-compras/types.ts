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
