import { apiClient } from '@/api/client'
import type { EstadoUsuario } from '@/modules/auth/types'

export function cambiarEstadoUsuario(usuarioId: string, estado: EstadoUsuario) {
  return apiClient<void>(`/auth/usuarios/${usuarioId}/estado`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado }),
  })
}
