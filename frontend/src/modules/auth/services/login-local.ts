import { apiClient } from '@/api/client'

export function loginLocal(email: string, password: string) {
  return apiClient<{ detail: string }>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}
