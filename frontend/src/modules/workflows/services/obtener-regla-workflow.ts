import { apiClient } from '@/api/client'
import { apiRegla } from '@/modules/workflows/constants'
import type { ReglaWorkflow } from '@/modules/workflows/types'

export function obtenerReglaWorkflow(id: string, signal?: AbortSignal) {
  return apiClient<ReglaWorkflow>(apiRegla(id), { signal })
}
