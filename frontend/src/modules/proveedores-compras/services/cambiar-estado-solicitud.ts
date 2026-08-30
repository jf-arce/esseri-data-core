import { apiClient } from '@/api/client'
import type { EstadoSolicitud, SolicitudCompra } from '@/modules/proveedores-compras/types'

// Endpoint propio, separado del PUT: aprobar o rechazar es una decision de negocio, no una
// correccion de datos.
export function cambiarEstadoSolicitud(solicitudId: string, estado: EstadoSolicitud) {
  return apiClient<SolicitudCompra>(`/proveedores-compras/solicitudes/${solicitudId}/estado`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado }),
  })
}
