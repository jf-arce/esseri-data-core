import { apiClient } from '@/api/client'

export function quitarRolAUsuario(usuarioId: string, rolId: string) {
  return apiClient<void>(`/auth/usuarios/${usuarioId}/roles/${rolId}`, { method: 'DELETE' })
}
