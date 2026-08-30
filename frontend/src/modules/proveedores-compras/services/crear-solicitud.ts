import { apiClient } from '@/api/client'
import type { CrearSolicitudPayload, SolicitudCompra } from '@/modules/proveedores-compras/types'

export function crearSolicitud(datos: CrearSolicitudPayload) {
  return apiClient<SolicitudCompra>('/proveedores-compras/solicitudes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
