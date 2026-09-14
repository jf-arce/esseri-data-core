import { apiClient } from '@/api/client'

export function eliminarUsuario(usuarioId: string) {
  return apiClient<void>(`/auth/usuarios/${usuarioId}`, { method: 'DELETE' })
}
