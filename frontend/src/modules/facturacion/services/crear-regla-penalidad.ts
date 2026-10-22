import { apiClient } from '@/api/client'
import type { ReglaPenalidad, ReglaPenalidadPayload } from '@/modules/facturacion/types'

export function crearReglaPenalidad(datos: ReglaPenalidadPayload) {
  return apiClient<ReglaPenalidad>('/facturacion/penalidades', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
