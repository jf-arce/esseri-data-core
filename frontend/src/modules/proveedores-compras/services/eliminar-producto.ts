import { apiClient } from '@/api/client'

export function eliminarProducto(productoId: string) {
  return apiClient<void>(`/proveedores-compras/productos/${productoId}`, {
    method: 'DELETE',
  })
}
