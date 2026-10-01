import { apiClient } from '@/api/client'
import { API_REGLAS } from '@/modules/workflows/constants'
import type { ReglaWorkflow, ReglaWorkflowCreatePayload } from '@/modules/workflows/types'

export function crearReglaWorkflow(datos: ReglaWorkflowCreatePayload) {
  return apiClient<ReglaWorkflow>(API_REGLAS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
