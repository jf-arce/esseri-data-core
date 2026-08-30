import { apiClient } from '@/api/client'
import type {
  CrearSolicitudAdmisionPayload,
  SolicitudAdmision,
} from '@/modules/inscripciones/types'

export function crearSolicitudAdmision(datos: CrearSolicitudAdmisionPayload) {
  return apiClient<SolicitudAdmision>('/inscripciones/solicitudes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
