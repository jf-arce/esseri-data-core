import { apiClient } from '@/api/client'
import type { LecturaNotificacion } from '../types'

export function marcarNotificacionLeida(id: string) {
  return apiClient<LecturaNotificacion>(`/notificaciones/${id}/lectura`, {
    method: 'PATCH',
  })
}
