import { apiClient } from '@/api/client'
import { apiTarea } from '@/modules/workflows/constants'
import type { TareaDetalle } from '@/modules/workflows/types'

export function obtenerTarea(id: string, signal?: AbortSignal) {
  return apiClient<TareaDetalle>(apiTarea(id), { signal })
}
