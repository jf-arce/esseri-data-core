import { apiClient } from '@/api/client'
import type { Rol } from '@/modules/auth/types'

export function getRoles() {
  return apiClient<Rol[]>('/auth/roles')
}
