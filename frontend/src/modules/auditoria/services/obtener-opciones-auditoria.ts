import { apiClient } from '@/api/client'
import { API_AUDITORIA } from '@/modules/auditoria/constants'
import type { OpcionesAuditoria } from '@/modules/auditoria/types'

export function obtenerOpcionesAuditoria(signal?: AbortSignal) {
  return apiClient<OpcionesAuditoria>(`${API_AUDITORIA}/opciones`, { signal })
}
