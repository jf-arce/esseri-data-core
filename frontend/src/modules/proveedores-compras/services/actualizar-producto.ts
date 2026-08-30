import { apiClient } from '@/api/client'
import type {
  ActualizarProductoPayload,
  ProductoServicio,
} from '@/modules/proveedores-compras/types'

export function actualizarProducto(productoId: string, datos: ActualizarProductoPayload) {
  return apiClient<ProductoServicio>(`/proveedores-compras/productos/${productoId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
