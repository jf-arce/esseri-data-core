import { apiClient } from '@/api/client'

export function eliminarSolicitud(solicitudId: string) {
  return apiClient<void>(`/proveedores-compras/solicitudes/${solicitudId}`, {
    method: 'DELETE',
  })
}
