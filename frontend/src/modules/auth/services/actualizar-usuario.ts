import { apiClient } from '@/api/client'
import type { UsuarioDetalle, UsuarioUpdate } from '@/modules/auth/types'

export function actualizarUsuario(usuarioId: string, datos: UsuarioUpdate) {
  return apiClient<UsuarioDetalle>(`/auth/usuarios/${usuarioId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
