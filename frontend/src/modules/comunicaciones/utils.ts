import type { Adjunto, Canal, EstadoAdjunto, TipoComunicacion } from './types'

export const ETIQUETAS_TIPO: Record<TipoComunicacion, string> = {
  institucional: 'Institucional',
  curso: 'Curso',
  administrativa: 'Administrativa',
  otro: 'Otro',
}

export const DESCRIPCIONES_TIPO: Record<TipoComunicacion, string> = {
  institucional: 'Novedades y avisos del colegio',
  curso: 'Información para un curso o división',
  administrativa: 'Información de gestión',
  otro: 'Otro tipo de comunicación',
}

export const MAX_ADJUNTOS = 5
export const MAX_TAMANIO_ADJUNTO = 5 * 1024 * 1024
export const MAX_TAMANIO_TOTAL = 25 * 1024 * 1024

export const TIPOS_ADJUNTO = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
}

export const AYUDA_ADJUNTOS =
  'PDF, JPG o PNG · hasta 5 archivos · 5 MB por archivo · 25 MB en total.'

export const ETIQUETAS_CANAL: Record<Canal, string> = {
  portal: 'Solo portal',
  email: 'Solo email',
  ambos: 'Portal y email',
}

export const DESCRIPCIONES_CANAL: Record<Canal, string> = {
  portal: 'Se publica en la bandeja del portal familiar.',
  email: 'No aparece en la bandeja del portal: se envía por email a los responsables.',
  ambos: 'Se publica en el portal y también se envía por email.',
}

export const ETIQUETAS_ESTADO_ADJUNTO: Record<EstadoAdjunto, string> = {
  cuarentena: 'Analizando',
  limpio: 'Verificado',
  rechazado: 'Rechazado',
  error: 'Error de análisis',
}

type VarianteBadge = 'exito' | 'advertencia' | 'error' | 'info' | 'neutro'

export function badgeEstadoAdjunto(estado: EstadoAdjunto): VarianteBadge {
  if (estado === 'limpio') return 'exito'
  if (estado === 'cuarentena') return 'advertencia'
  if (estado === 'rechazado' || estado === 'error') return 'error'
  return 'neutro'
}

export function formatearTamanio(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** Un adjunto en cuarentena o con error todavía no habilitó la publicación. */
export function adjuntosPendientes(adjuntos: Adjunto[]): Adjunto[] {
  return adjuntos.filter((adjunto) => adjunto.estado !== 'limpio')
}

export function puedePublicar(adjuntos: Adjunto[]): boolean {
  return adjuntosPendientes(adjuntos).length === 0
}

/** Valida cupo, peso individual y peso total antes de subir. Devuelve el error o null. */
export function validarAdjuntosNuevos(archivos: File[], existentes: Adjunto[]): string | null {
  if (existentes.length + archivos.length > MAX_ADJUNTOS)
    return `Podés adjuntar hasta ${MAX_ADJUNTOS} archivos.`
  const totalActual = existentes.reduce((total, adjunto) => total + adjunto.tamanio, 0)
  const totalNuevo = archivos.reduce((total, archivo) => total + archivo.size, 0)
  if (totalActual + totalNuevo > MAX_TAMANIO_TOTAL) return 'El total de archivos supera 25 MB.'
  if (archivos.some((archivo) => archivo.size > MAX_TAMANIO_ADJUNTO))
    return 'Cada archivo puede pesar como máximo 5 MB.'
  if (archivos.some((archivo) => archivo.size === 0)) return 'El archivo está vacío.'
  return null
}

export interface EstadoEnvio {
  etiqueta: string
  variante: VarianteBadge
  incierto: boolean
}

// "Enviado" nunca significa entregado: solo acredita que el servidor de correo aceptó el envío.
export function estadoEnvio(estado: string): EstadoEnvio {
  const clave = estado.toLowerCase()
  if (['pendiente', 'encolado', 'en_cola', 'programado'].includes(clave))
    return { etiqueta: 'En cola', variante: 'advertencia', incierto: false }
  if (['enviado', 'aceptado', 'presentado'].includes(clave))
    return { etiqueta: 'Enviado', variante: 'info', incierto: false }
  if (clave === 'procesando') return { etiqueta: 'En proceso', variante: 'info', incierto: false }
  if (clave === 'sin_email') return { etiqueta: 'Sin email', variante: 'error', incierto: false }
  if (['fallido', 'error'].includes(clave))
    return { etiqueta: 'Falló', variante: 'error', incierto: false }
  if (['incierto', 'desconocido'].includes(clave))
    return { etiqueta: 'Resultado incierto', variante: 'advertencia', incierto: true }
  return { etiqueta: estado, variante: 'neutro', incierto: false }
}
