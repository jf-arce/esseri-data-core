import { apiClient } from '@/api/client'
import type { ListadoNotificaciones } from '../types'

const LIMITE_POR_PAGINA = 20

export type ParametrosListarNotificaciones = {
  noLeidas: boolean
  limite?: number
  cursor?: string | null
  signal?: AbortSignal
}

export function listarNotificaciones({
  noLeidas,
  limite = LIMITE_POR_PAGINA,
  cursor,
  signal,
}: ParametrosListarNotificaciones) {
  const parametros = new URLSearchParams({
    no_leidas: String(noLeidas),
    limite: String(limite),
  })
  if (cursor) parametros.set('cursor', cursor)

  return signal
    ? apiClient<ListadoNotificaciones>(`/notificaciones?${parametros.toString()}`, {
        signal,
      })
    : apiClient<ListadoNotificaciones>(`/notificaciones?${parametros.toString()}`)
}
