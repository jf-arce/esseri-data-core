import { apiClient } from '@/api/client'
import type { IndicadoresAdministracion } from '@/modules/panel-admin/types'

export function obtenerIndicadoresAdministracion(signal?: AbortSignal) {
  return apiClient<IndicadoresAdministracion>('/panel-admin/indicadores-administracion', {
    signal,
  })
}
