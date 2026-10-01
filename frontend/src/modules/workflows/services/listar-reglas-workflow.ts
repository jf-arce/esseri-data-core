import { apiClient } from '@/api/client'
import { API_REGLAS } from '@/modules/workflows/constants'
import type { ReglaWorkflow } from '@/modules/workflows/types'

export function listarReglasWorkflow(signal?: AbortSignal) {
  return apiClient<ReglaWorkflow[]>(API_REGLAS, { signal })
}
