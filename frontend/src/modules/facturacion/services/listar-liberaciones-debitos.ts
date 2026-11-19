import { apiClient } from '@/api/client'
import type { LiberacionesDebitos } from '@/modules/facturacion/types'

export function listarLiberacionesDebitos(
  filtros: { pagina: number; tamanio: number },
  signal?: AbortSignal,
) {
  const parametros = new URLSearchParams()
  parametros.set('pagina', String(filtros.pagina))
  parametros.set('tamanio', String(filtros.tamanio))
  return apiClient<LiberacionesDebitos>(
    `/facturacion/cobranzas-simuladas/liberaciones?${parametros.toString()}`,
    { signal },
  )
}
