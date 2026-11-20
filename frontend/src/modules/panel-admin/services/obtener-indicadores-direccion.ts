import { apiClient } from '@/api/client'
import type { IndicadoresDireccion } from '@/modules/panel-admin/types'

export function obtenerIndicadoresDireccion(cicloLectivo?: string, signal?: AbortSignal) {
  const params = new URLSearchParams()
  if (cicloLectivo) params.set('ciclo_lectivo', cicloLectivo)
  const qs = params.toString() ? `?${params.toString()}` : ''
  return apiClient<IndicadoresDireccion>(`/panel-admin/indicadores-direccion${qs}`, { signal })
}
