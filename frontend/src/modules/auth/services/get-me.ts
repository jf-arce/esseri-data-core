import { apiClient } from '@/api/client'
import type { UsuarioActual } from '@/modules/auth/types'

export function getMe() {
  return apiClient<UsuarioActual>('/auth/me')
}
