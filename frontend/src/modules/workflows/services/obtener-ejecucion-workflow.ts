import { apiClient } from '@/api/client'
import { API_EJECUCIONES } from '@/modules/workflows/constants'
import type { EjecucionWorkflow } from '@/modules/workflows/types'

/** El detalle trae `recargo_estimado`, que el listado no calcula. */
export function obtenerEjecucionWorkflow(id: string, signal?: AbortSignal) {
  return apiClient<EjecucionWorkflow>(`${API_EJECUCIONES}/${id}`, { signal })
}
