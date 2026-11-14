import { apiClient } from '@/api/client'
import { apiEstadisticasRegla, DIAS_ESTADISTICAS } from '@/modules/workflows/constants'
import type { EstadisticasRegla } from '@/modules/workflows/types'

export function obtenerEstadisticasRegla(
  reglaId: string,
  dias: number = DIAS_ESTADISTICAS,
  signal?: AbortSignal,
) {
  return apiClient<EstadisticasRegla>(`${apiEstadisticasRegla(reglaId)}?dias=${dias}`, { signal })
}
