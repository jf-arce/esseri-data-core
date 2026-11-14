import { ApiError } from '@/api/client'
import { PREFIJO_API } from '../constants'
import type { EventoSse, PedidoMensaje } from '../types'
import { parsearSse } from '../utils'

const API_URL = import.meta.env.VITE_API_URL

/**
 * Envía un mensaje y entrega los eventos SSE a medida que llegan. Usa `fetch` y no `EventSource`
 * porque el envío es un POST con cuerpo. Se corta con la `signal`.
 */
export async function enviarMensaje(
  conversacionId: string,
  pedido: PedidoMensaje,
  signal: AbortSignal,
  alEvento: (evento: EventoSse) => void,
): Promise<void> {
  const respuesta = await fetch(
    `${API_URL}${PREFIJO_API}/conversaciones/${conversacionId}/mensajes`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(pedido),
      signal,
    },
  )
  if (!respuesta.ok) {
    const detalle = await respuesta
      .json()
      .then((cuerpo: { detail?: unknown }) =>
        typeof cuerpo.detail === 'string' ? cuerpo.detail : null,
      )
      .catch(() => null)
    throw new ApiError(respuesta.status, detalle)
  }
  if (respuesta.body === null) return

  const lector = respuesta.body.pipeThrough(new TextDecoderStream()).getReader()
  let resto = ''
  for (;;) {
    const { done, value } = await lector.read()
    if (done) break
    const parseado = parsearSse(resto, value)
    resto = parseado.resto
    parseado.eventos.forEach(alEvento)
  }
}
