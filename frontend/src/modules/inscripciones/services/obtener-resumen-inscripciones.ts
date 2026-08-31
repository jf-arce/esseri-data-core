import { apiClient } from '@/api/client'
import type { ResumenInscripciones } from '@/modules/inscripciones/types'

export function obtenerResumenInscripciones(cicloLectivo: string, signal?: AbortSignal) {
  const parametros = new URLSearchParams({ ciclo_lectivo: cicloLectivo })
  return apiClient<ResumenInscripciones>(`/inscripciones/resumen?${parametros.toString()}`, {
    signal,
  })
}
