import { apiClient } from '@/api/client'
import type { Comunicacion } from '../types'
export function publicarComunicacion(id: string) {
  return apiClient<Comunicacion>(`/comunicaciones/${id}/publicar`, { method: 'POST' })
}
