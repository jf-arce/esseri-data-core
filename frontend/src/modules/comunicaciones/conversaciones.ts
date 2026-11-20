import { apiClient } from '@/api/client'
import { descargarExport } from '@/lib/descargar-export'

export type TipoContexto =
  'debito_cobranza' | 'justificacion_inasistencia' | 'solicitud_ausencia_periodo'
export type EstadoConversacion = 'pendiente_administracion' | 'pendiente_familia' | 'resuelta'
export type Contexto = {
  tipo: TipoContexto
  id: string
  alumno_nombre: string
  fecha_inicio: string
  fecha_fin?: string | null
  estado_tramite?: string | null
  factura_id?: string | null
}
export type Conversacion = {
  id: string
  contexto: Contexto
  estado: EstadoConversacion
  puede_responder: boolean
  puede_gestionar: boolean
  adjuntos_habilitados: boolean
}
type AdjuntoMensaje = { id: string; nombre: string }
export type Mensaje = {
  id: string
  autor: string
  texto: string
  created_at: string
  adjuntos?: AdjuntoMensaje[]
}
export type Historial = { items: Mensaje[]; siguiente: string | null }
type EstadoContexto = {
  contexto: Contexto
  conversacion: Conversacion | null
  puede_iniciar: boolean
  adjuntos_habilitados: boolean
}
type Bandeja = { items: Conversacion[]; siguiente_offset: number | null }

export const TITULOS: Record<TipoContexto, string> = {
  debito_cobranza: 'Débito rechazado',
  justificacion_inasistencia: 'Justificación de inasistencia',
  solicitud_ausencia_periodo: 'Justificación por período',
}

export const ESTADOS: Record<EstadoConversacion, string> = {
  pendiente_administracion: 'Pendiente de Administración',
  pendiente_familia: 'Pendiente de la familia',
  resuelta: 'Resuelta',
}

export const URL_CONVERSACIONES = '/comunicaciones/conversaciones'

export function rutaConversaciones(familia: boolean) {
  return familia ? '/familia/conversaciones' : URL_CONVERSACIONES
}

export function rutaContexto(tipo: TipoContexto, id: string, familia = false) {
  return `${rutaConversaciones(familia)}/contextos/${tipo}/${encodeURIComponent(id)}`
}

function apiContexto(tipo: string, id: string) {
  return `${URL_CONVERSACIONES}/contextos/${encodeURIComponent(tipo)}/${encodeURIComponent(id)}`
}

export function consultarContexto(tipo: string, id: string, signal: AbortSignal) {
  return apiClient<EstadoContexto>(apiContexto(tipo, id), { signal })
}

export function consultarHilo(id: string, signal: AbortSignal) {
  return apiClient<Conversacion>(`${URL_CONVERSACIONES}/${encodeURIComponent(id)}`, { signal })
}

export function listarMensajes(id: string, signal: AbortSignal, antes?: string) {
  const cursor = antes ? `?antes=${encodeURIComponent(antes)}` : ''
  return apiClient<Historial>(`${URL_CONVERSACIONES}/${encodeURIComponent(id)}/mensajes${cursor}`, {
    signal,
  })
}

function envio(texto: string, clave: string, signal: AbortSignal, archivos: File[]): RequestInit {
  if (archivos.length) {
    const body = new FormData()
    body.append('texto', texto)
    body.append('clave', clave)
    for (const archivo of archivos) body.append('archivos', archivo)
    return { method: 'POST', body, signal }
  }
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texto, clave }),
    signal,
  }
}

export function iniciarHilo(
  tipo: string,
  id: string,
  texto: string,
  clave: string,
  signal: AbortSignal,
  archivos: File[],
) {
  const url = apiContexto(tipo, id)
  return apiClient<Conversacion>(
    archivos.length ? `${url}/con-adjuntos` : url,
    envio(texto, clave, signal, archivos),
  )
}

export function enviarMensaje(
  id: string,
  texto: string,
  clave: string,
  signal: AbortSignal,
  archivos: File[],
) {
  const url = `${URL_CONVERSACIONES}/${encodeURIComponent(id)}/mensajes`
  return apiClient<Mensaje>(
    archivos.length ? `${url}/con-adjuntos` : url,
    envio(texto, clave, signal, archivos),
  )
}

export function descargarAdjunto(id: string, mensaje: string, adjunto: AdjuntoMensaje) {
  return descargarExport(
    `${URL_CONVERSACIONES}/${encodeURIComponent(id)}/mensajes/${encodeURIComponent(mensaje)}/adjuntos/${encodeURIComponent(adjunto.id)}`,
    adjunto.nombre,
  )
}

export function gestionarHilo(id: string, accion: 'resolver' | 'reabrir', signal: AbortSignal) {
  return apiClient<Conversacion>(`${URL_CONVERSACIONES}/${encodeURIComponent(id)}/${accion}`, {
    method: 'POST',
    signal,
  })
}

export function listarConversaciones(
  estado: EstadoConversacion,
  offset: number,
  signal: AbortSignal,
) {
  return apiClient<Bandeja>(
    `${URL_CONVERSACIONES}?${new URLSearchParams({
      estado,
      offset: String(offset),
    })}`,
    { signal },
  )
}
