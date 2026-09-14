import { apiClient } from '@/api/client'
import type { AccesoUpdate } from '@/modules/auth/types'

export function actualizarAccesoUsuario(usuarioId: string, datos: AccesoUpdate) {
  return apiClient<void>(`/auth/usuarios/${usuarioId}/acceso`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
