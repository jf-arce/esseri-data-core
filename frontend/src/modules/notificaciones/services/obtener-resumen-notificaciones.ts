import { apiClient } from '@/api/client'
import type { ResumenNotificaciones } from '../types'

export function obtenerResumenNotificaciones(signal?: AbortSignal) {
  return signal
    ? apiClient<ResumenNotificaciones>('/notificaciones/resumen', { signal })
    : apiClient<ResumenNotificaciones>('/notificaciones/resumen')
}
