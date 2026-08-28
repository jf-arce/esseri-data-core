import { apiClient } from '@/api/client'

export function eliminarPermiso(permisoId: string) {
  return apiClient<void>(`/auth/permisos/${permisoId}`, { method: 'DELETE' })
}
