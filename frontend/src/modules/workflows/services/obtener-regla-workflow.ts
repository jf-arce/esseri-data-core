import { apiClient } from '@/api/client'
import type { ReglaWorkflow } from '@/modules/workflows/types'

export function obtenerReglaWorkflow(id: string, signal?: AbortSignal) {
  return apiClient<ReglaWorkflow>(`/workflows/reglas/${id}`, { signal })
}
