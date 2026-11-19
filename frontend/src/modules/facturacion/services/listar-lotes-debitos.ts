import { apiClient } from '@/api/client'
import type { HistorialLotesDebitos, EstadoLoteDebitos } from '@/modules/facturacion/types'

export interface FiltrosLotesDebitos {
  periodo?: string
  estado?: EstadoLoteDebitos
  buscar?: string
  pagina: number
  tamanio: number
}

export function listarLotesDebitos(filtros: FiltrosLotesDebitos, signal?: AbortSignal) {
  const parametros = new URLSearchParams()
  if (filtros.periodo) parametros.set('periodo', filtros.periodo)
  if (filtros.estado) parametros.set('estado', filtros.estado)
  if (filtros.buscar) parametros.set('buscar', filtros.buscar)
  parametros.set('pagina', String(filtros.pagina))
  parametros.set('tamanio', String(filtros.tamanio))
  return apiClient<HistorialLotesDebitos>(
    `/facturacion/cobranzas-simuladas?${parametros.toString()}`,
    { signal },
  )
}
