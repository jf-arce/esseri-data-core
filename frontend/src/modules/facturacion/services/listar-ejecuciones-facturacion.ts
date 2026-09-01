import { apiClient } from '@/api/client'
import type { EjecucionFacturacion } from '@/modules/facturacion/types'

export function listarEjecucionesFacturacion(limite = 100, signal?: AbortSignal) {
  return apiClient<EjecucionFacturacion[]>(`/facturacion/reglas/generaciones?limite=${limite}`, {
    signal,
  })
}
