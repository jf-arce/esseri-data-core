import { apiClient } from '@/api/client'

export function asignarPermisoARol(rolId: string, permisoId: string) {
  return apiClient<void>(`/auth/roles/${rolId}/permisos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ permiso_id: permisoId }),
  })
}
