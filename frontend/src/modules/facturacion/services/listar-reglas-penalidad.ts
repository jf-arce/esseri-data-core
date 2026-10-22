import { apiClient } from '@/api/client'
import type { ReglaPenalidad } from '@/modules/facturacion/types'

export function listarReglasPenalidad(signal?: AbortSignal) {
  return apiClient<ReglaPenalidad[]>('/facturacion/penalidades', { signal })
}
