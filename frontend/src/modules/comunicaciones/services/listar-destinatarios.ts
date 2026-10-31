import { apiClient } from '@/api/client'
import type { ListadoDestinatarios, VistaDestinatarios } from '../types'

export function listarDestinatarios(
  comunicacionId: string,
  vista: VistaDestinatarios,
  pagina: number,
  buscar: string,
  docente: boolean,
  signal: AbortSignal,
) {
  const base = docente ? '/comunicaciones/docente' : '/comunicaciones'
  const query = new URLSearchParams({ vista, pagina: String(pagina), buscar })
  return apiClient<ListadoDestinatarios>(`${base}/${comunicacionId}/destinatarios?${query}`, {
    signal,
  })
}
