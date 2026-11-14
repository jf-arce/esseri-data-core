import { apiClient } from '@/api/client'
import { PREFIJO_API } from '../constants'
import type { AliasResuelto, Conversacion, MensajeAsistente, Pagina } from '../types'

export function crearConversacion() {
  return apiClient<Conversacion>(`${PREFIJO_API}/conversaciones`, { method: 'POST' })
}

export function listarConversaciones(signal?: AbortSignal) {
  return apiClient<Pagina<Conversacion>>(`${PREFIJO_API}/conversaciones?tamanio=50`, { signal })
}

export function listarMensajes(conversacionId: string, signal?: AbortSignal) {
  return apiClient<Pagina<MensajeAsistente>>(
    `${PREFIJO_API}/conversaciones/${conversacionId}/mensajes?tamanio=200`,
    { signal },
  )
}

export function eliminarConversacion(conversacionId: string) {
  return apiClient<void>(`${PREFIJO_API}/conversaciones/${conversacionId}`, { method: 'DELETE' })
}

export function resolverAliases(conversacionId: string, aliases: string[], signal?: AbortSignal) {
  return apiClient<{ items: AliasResuelto[] }>(`${PREFIJO_API}/resolver`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversacion_id: conversacionId, aliases }),
    signal,
  })
}
