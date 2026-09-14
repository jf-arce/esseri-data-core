import { apiClient } from '@/api/client'
import type { UsuarioConRoles, UsuarioCreate } from '@/modules/auth/types'

export function crearUsuario(datos: UsuarioCreate) {
  return apiClient<UsuarioConRoles>('/auth/usuarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
