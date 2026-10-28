import { apiClient } from '@/api/client'
import { apiRechazarEjecucion } from '@/modules/workflows/constants'
import type { EjecucionWorkflow } from '@/modules/workflows/types'

export function rechazarEjecucionWorkflow(id: string, motivo: string) {
  return apiClient<EjecucionWorkflow>(apiRechazarEjecucion(id), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ motivo }),
  })
}
