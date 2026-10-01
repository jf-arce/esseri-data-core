import { apiClient } from '@/api/client'
import type { ReglaWorkflow, ReglaWorkflowCreatePayload } from '@/modules/workflows/types'

export function crearReglaWorkflow(datos: ReglaWorkflowCreatePayload) {
  return apiClient<ReglaWorkflow>('/workflows/reglas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
