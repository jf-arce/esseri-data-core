import { apiClient } from '@/api/client'
import type { UsuarioConRoles } from '@/modules/auth/types'

export function getUsuarios() {
  return apiClient<UsuarioConRoles[]>('/auth/usuarios')
}
