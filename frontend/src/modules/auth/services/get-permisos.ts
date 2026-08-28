import { apiClient } from '@/api/client'
import type { Permiso } from '@/modules/auth/types'

export function getPermisos(modulo?: string) {
  const query = modulo ? `?modulo=${encodeURIComponent(modulo)}` : ''
  return apiClient<Permiso[]>(`/auth/permisos${query}`)
}
