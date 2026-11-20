import { apiClient } from '@/api/client'
import type { Sugerencia } from '@/modules/ia-sugerencias/types'

export function listarSugerencias(estado?: string) {
  const qs = estado ? `?estado=${encodeURIComponent(estado)}` : ''
  return apiClient<Sugerencia[]>(`/ia-sugerencias/sugerencias${qs}`)
}
