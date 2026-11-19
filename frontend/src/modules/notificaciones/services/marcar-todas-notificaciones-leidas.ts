import { apiClient } from '@/api/client'
import type { ResultadoLecturas } from '../types'

export function marcarTodasNotificacionesLeidas() {
  return apiClient<ResultadoLecturas>('/notificaciones/lecturas', {
    method: 'POST',
  })
}
