import { apiClient } from '@/api/client'

export function asignarRolAUsuario(usuarioId: string, rolId: string) {
  return apiClient<void>(`/auth/usuarios/${usuarioId}/roles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rol_id: rolId }),
  })
}
