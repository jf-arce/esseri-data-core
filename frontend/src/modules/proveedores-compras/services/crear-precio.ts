import { apiClient } from '@/api/client'
import type { CrearPrecioPayload, PrecioProducto } from '@/modules/proveedores-compras/types'

export function crearPrecio(productoId: string, datos: CrearPrecioPayload) {
  return apiClient<PrecioProducto>(`/proveedores-compras/productos/${productoId}/precios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
