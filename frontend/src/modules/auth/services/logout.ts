import { apiClient } from '@/api/client'

export function logout() {
  return apiClient<{ detail: string }>('/auth/logout', { method: 'POST' })
}
