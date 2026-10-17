import { apiClient } from '@/api/client'
import { apiAprobarEjecucion } from '@/modules/workflows/constants'
import type { EjecucionWorkflow } from '@/modules/workflows/types'

export function aprobarEjecucionWorkflow(id: string) {
  return apiClient<EjecucionWorkflow>(apiAprobarEjecucion(id), { method: 'POST' })
}
