import { apiClient } from '@/api/client'

export function quitarPermisoARol(rolId: string, permisoId: string) {
  return apiClient<void>(`/auth/roles/${rolId}/permisos/${permisoId}`, { method: 'DELETE' })
}
