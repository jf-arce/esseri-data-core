import { apiClient } from '@/api/client'
import { apiReintentarEjecucion } from '@/modules/workflows/constants'
import type { EjecucionWorkflow } from '@/modules/workflows/types'

export function reintentarEjecucionWorkflow(id: string) {
  return apiClient<EjecucionWorkflow>(apiReintentarEjecucion(id), { method: 'POST' })
}
