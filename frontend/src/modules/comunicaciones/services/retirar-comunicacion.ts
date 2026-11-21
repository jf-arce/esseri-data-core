import { apiClient } from '@/api/client'

export function retirarComunicacion(id: string) {
  return apiClient<void>(`/comunicaciones/${id}/retirar`, { method: 'POST' })
}
