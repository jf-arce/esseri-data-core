import { apiClient } from '@/api/client'
import { apiNotificacion } from '@/modules/workflows/constants'
import type { NotificacionEnviadaDetalle } from '@/modules/workflows/types'

export function obtenerNotificacion(id: string, signal?: AbortSignal) {
  return apiClient<NotificacionEnviadaDetalle>(apiNotificacion(id), { signal })
}
