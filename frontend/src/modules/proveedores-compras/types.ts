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
