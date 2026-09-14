import { apiClient } from '@/api/client'

export function setRolActivoRemoto(rol: string) {
  return apiClient<{ detail: string }>('/auth/rol-activo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rol }),
  })
}
