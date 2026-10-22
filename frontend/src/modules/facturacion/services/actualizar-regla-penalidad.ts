import { apiClient } from '@/api/client'
import type { ReglaPenalidad, ReglaPenalidadPayload } from '@/modules/facturacion/types'

export function actualizarReglaPenalidad(id: string, datos: ReglaPenalidadPayload) {
  return apiClient<ReglaPenalidad>(`/facturacion/penalidades/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
