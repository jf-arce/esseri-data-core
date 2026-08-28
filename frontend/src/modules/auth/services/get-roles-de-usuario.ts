import { apiClient } from '@/api/client'
import type { Rol } from '@/modules/auth/types'

export function getRolesDeUsuario(usuarioId: string) {
  return apiClient<Rol[]>(`/auth/usuarios/${usuarioId}/roles`)
}
