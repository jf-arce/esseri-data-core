import { apiClient } from '@/api/client'
import type { ReglaWorkflow, ReglaWorkflowPatch } from '@/modules/workflows/types'

export function actualizarReglaWorkflow(id: string, datos: ReglaWorkflowPatch) {
  return apiClient<ReglaWorkflow>(`/workflows/reglas/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
