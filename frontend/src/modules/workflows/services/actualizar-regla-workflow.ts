import { apiClient } from '@/api/client'
import { apiRegla } from '@/modules/workflows/constants'
import type { ReglaWorkflow, ReglaWorkflowPatch } from '@/modules/workflows/types'

export function actualizarReglaWorkflow(id: string, datos: ReglaWorkflowPatch) {
  return apiClient<ReglaWorkflow>(apiRegla(id), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
