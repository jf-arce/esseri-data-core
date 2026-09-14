import { apiClient } from '@/api/client'
import type { UsuarioDetalle } from '@/modules/auth/types'

export function getUsuario(usuarioId: string) {
  return apiClient<UsuarioDetalle>(`/auth/usuarios/${usuarioId}`)
}
