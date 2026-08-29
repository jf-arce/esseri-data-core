import { apiClient } from '@/api/client'
import type {
  ActualizarSolicitudPayload,
  SolicitudCompra,
} from '@/modules/proveedores-compras/types'

export function actualizarSolicitud(solicitudId: string, datos: ActualizarSolicitudPayload) {
  return apiClient<SolicitudCompra>(`/proveedores-compras/solicitudes/${solicitudId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
