import { apiClient } from '@/api/client'
import type { Envio, FiltroEntrega, ListadoEntrega } from '../types'

export function listarEntrega(
  comunicacionId: string,
  pagina: number,
  buscar: string,
  filtro: FiltroEntrega,
  docente: boolean,
  signal: AbortSignal,
) {
  const base = docente ? '/comunicaciones/docente' : '/comunicaciones'
  const query = new URLSearchParams({
    pagina: String(pagina),
    buscar,
    filtro,
  })
  return apiClient<ListadoEntrega>(`${base}/${comunicacionId}/entrega?${query}`, { signal })
}

export function reintentarEnvio(id: string, envioId: string, docente = false) {
  const base = docente ? '/comunicaciones/docente' : '/comunicaciones'
  return apiClient<Envio>(`${base}/${id}/envios/${envioId}/reintentar`, { method: 'POST' })
}
