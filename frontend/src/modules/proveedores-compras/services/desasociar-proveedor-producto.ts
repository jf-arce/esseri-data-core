import { apiClient } from '@/api/client'

export function desasociarProveedorDeProducto(productoId: string, proveedorId: string) {
  return apiClient<void>(
    `/proveedores-compras/productos/${productoId}/proveedores/${proveedorId}`,
    { method: 'DELETE' },
  )
}
