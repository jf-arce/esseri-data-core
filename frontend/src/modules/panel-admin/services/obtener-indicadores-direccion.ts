import { apiClient } from '@/api/client'
import type { IndicadoresDireccion } from '@/modules/panel-admin/types'

export function obtenerIndicadoresDireccion(signal?: AbortSignal) {
  return apiClient<IndicadoresDireccion>('/panel-admin/indicadores-direccion', { signal })
}
