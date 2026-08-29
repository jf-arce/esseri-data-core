import { apiClient } from '@/api/client'

export function eliminarProveedor(proveedorId: string) {
  return apiClient<void>(`/proveedores-compras/proveedores/${proveedorId}`, {
    method: 'DELETE',
  })
}
