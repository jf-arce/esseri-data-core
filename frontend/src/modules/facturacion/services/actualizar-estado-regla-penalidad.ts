import { apiClient } from '@/api/client'
import type { ReglaPenalidad } from '@/modules/facturacion/types'

export function actualizarEstadoReglaPenalidad(id: string, activo: boolean) {
  return apiClient<ReglaPenalidad>(`/facturacion/penalidades/${id}/estado`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activo }),
  })
}
