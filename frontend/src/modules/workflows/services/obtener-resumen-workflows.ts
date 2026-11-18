import { apiClient } from '@/api/client'
import { API_RESUMEN, DIAS_RESUMEN } from '@/modules/workflows/constants'
import type { ResumenWorkflows } from '@/modules/workflows/types'

export function obtenerResumenWorkflows(dias: number = DIAS_RESUMEN, signal?: AbortSignal) {
  return apiClient<ResumenWorkflows>(`${API_RESUMEN}?dias=${dias}`, { signal })
}
