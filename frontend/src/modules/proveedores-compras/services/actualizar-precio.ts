import { apiClient } from '@/api/client'
import type { ActualizarPrecioPayload, PrecioProducto } from '@/modules/proveedores-compras/types'

export function actualizarPrecio(precioId: string, datos: ActualizarPrecioPayload) {
  return apiClient<PrecioProducto>(`/proveedores-compras/precios/${precioId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
