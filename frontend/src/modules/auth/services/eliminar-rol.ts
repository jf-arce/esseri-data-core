import { apiClient } from '@/api/client'

export function eliminarRol(rolId: string) {
  return apiClient<void>(`/auth/roles/${rolId}`, { method: 'DELETE' })
}
