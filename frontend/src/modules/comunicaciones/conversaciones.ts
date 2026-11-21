import { apiClient } from '@/api/client'
import { guardarArchivo, obtenerExport } from '@/lib/descargar-export'

export type TipoContexto =
  'debito_cobranza' | 'justificacion_inasistencia' | 'solicitud_ausencia_periodo'
export type EstadoConversacion = 'pendiente_administracion' | 'pendiente_familia' | 'resuelta'
export type Contexto = {
  tipo: TipoContexto
  id: string
  alumno_nombre: string
  alumno_id: string
  fecha_inicio: string
  fecha_fin?: string | null
  estado_tramite?: string | null
  factura_id?: string | null
  alumno_curso?: string | null
  concepto?: string | null
  importe?: string | null
  motivo?: string | null
  fecha_intento?: string | null
}
export type Conversacion = {
  id: string
  contexto: Contexto
  estado: EstadoConversacion
  updated_at: string
  puede_responder: boolean
  puede_gestionar: boolean
  adjuntos_habilitados: boolean
}
type AdjuntoMensaje = { id: string; nombre: string; tipo_contenido: string; tamanio: number }
export type Mensaje = {
  id: string
  lado: 'familia' | 'administracion'
  autor: string
  texto: string
  created_at: string
  adjuntos?: AdjuntoMensaje[]
}
export type Historial = { items: Mensaje[]; siguiente: string | null }
export type ConsultaResumen = Conversacion & {
  ultimo_mensaje: { texto: string; lado: 'familia' | 'administracion'; created_at: string } | null
}
export type Bandeja = {
  items: ConsultaResumen[]
  siguiente_offset: number | null
  total: number
  resumen: { total: number; pendientes: number; resueltas: number } | null
}
type EstadoContexto = {
  contexto: Contexto
  conversacion: Conversacion | null
  puede_iniciar: boolean
  adjuntos_habilitados: boolean
}

export const TITULOS: Record<TipoContexto, string> = {
  debito_cobranza: 'Débito rechazado',
  justificacion_inasistencia: 'Justificación de inasistencia',
  solicitud_ausencia_periodo: 'Justificación por período',
}

export const ESTADOS: Record<EstadoConversacion, string> = {
  pendiente_administracion: 'Esperando a Administración',
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

export async function descargarAdjunto(id: string, mensaje: string, adjunto: AdjuntoMensaje) {
  const { blob } = await obtenerExport(
    `${URL_CONVERSACIONES}/${encodeURIComponent(id)}/mensajes/${encodeURIComponent(mensaje)}/adjuntos/${encodeURIComponent(adjunto.id)}`,
    adjunto.nombre,
  )
  guardarArchivo(blob, adjunto.nombre)
}

export function gestionarHilo(id: string, accion: 'resolver' | 'reabrir', signal: AbortSignal) {
  return apiClient<Conversacion>(`${URL_CONVERSACIONES}/${encodeURIComponent(id)}/${accion}`, {
    method: 'POST',
    signal,
  })
}

export function listarConversaciones(
  filtros: {
    estado?: EstadoConversacion
    abiertas?: boolean
    buscar?: string
    offset?: number
    limite?: number
  },
  signal: AbortSignal,
) {
  const parametros = new URLSearchParams()
  if (filtros.estado) parametros.set('estado', filtros.estado)
  if (filtros.abiertas) parametros.set('abiertas', 'true')
  if (filtros.buscar?.trim()) parametros.set('buscar', filtros.buscar.trim())
  parametros.set('offset', String(filtros.offset ?? 0))
  if (filtros.limite) parametros.set('limite', String(filtros.limite))
  return apiClient<Bandeja>(`${URL_CONVERSACIONES}?${parametros}`, { signal })
}
