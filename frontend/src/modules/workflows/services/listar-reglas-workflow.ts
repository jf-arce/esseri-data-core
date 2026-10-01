import { apiClient } from '@/api/client'
import type { ReglaWorkflow } from '@/modules/workflows/types'

export function listarReglasWorkflow(signal?: AbortSignal) {
  return apiClient<ReglaWorkflow[]>('/workflows/reglas', { signal })
}
