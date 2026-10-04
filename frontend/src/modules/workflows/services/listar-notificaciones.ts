import { apiClient } from '@/api/client'
import { API_NOTIFICACIONES } from '@/modules/workflows/constants'
import type { FiltrosNotificaciones, NotificacionEnviadaListado } from '@/modules/workflows/types'

export function listarNotificaciones(filtros: FiltrosNotificaciones, signal?: AbortSignal) {
  const parametros = new URLSearchParams({
    pagina: String(filtros.pagina),
    tamanio_pagina: String(filtros.tamanioPagina),
  })

  if (filtros.estadoEnvio) parametros.set('estado_envio', filtros.estadoEnvio)
  if (filtros.destinatarioTipo) parametros.set('destinatario_tipo', filtros.destinatarioTipo)

  return apiClient<NotificacionEnviadaListado>(`${API_NOTIFICACIONES}?${parametros.toString()}`, {
    signal,
  })
}
