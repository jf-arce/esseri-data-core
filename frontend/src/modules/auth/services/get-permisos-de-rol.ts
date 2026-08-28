import { apiClient } from '@/api/client'
import type { Permiso } from '@/modules/auth/types'

export function getPermisosDeRol(rolId: string) {
  return apiClient<Permiso[]>(`/auth/roles/${rolId}/permisos`)
}
