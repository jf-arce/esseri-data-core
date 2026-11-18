import {
  BellIcon,
  CalendarXIcon,
  CircleCheckIcon,
  CircleXIcon,
  type LucideIcon,
} from 'lucide-react'
import {
  TIPOS_RECURSO_NOTIFICACION,
  type DestinoNotificacion,
  type TipoNotificacion,
  type TipoRecursoNotificacion,
} from './types'

const ZONA_HORARIA_ARGENTINA = 'America/Argentina/Buenos_Aires'

const formatoHora = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: ZONA_HORARIA_ARGENTINA,
})

const formatoClaveDia = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: ZONA_HORARIA_ARGENTINA,
})

const formatoMesCorto = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: 'short',
  timeZone: ZONA_HORARIA_ARGENTINA,
})

const formatoAnio = new Intl.DateTimeFormat('es-AR', {
  year: 'numeric',
  timeZone: ZONA_HORARIA_ARGENTINA,
})

const ESTILOS_POR_TIPO: Record<TipoNotificacion, { icon: LucideIcon; tileClassName: string }> = {
  'academico.inasistencia_registrada': {
    icon: CalendarXIcon,
    tileClassName: 'bg-sup-academico text-mod-academico',
  },
  'academico.justificacion_aprobada': {
    icon: CircleCheckIcon,
    tileClassName: 'bg-exito-suave text-exito',
  },
  'academico.justificacion_rechazada': {
    icon: CircleXIcon,
    tileClassName: 'bg-error-suave text-error',
  },
}

const ESTILO_GENERICO = {
  icon: BellIcon,
  tileClassName: 'bg-sup-academico text-mod-academico',
}

export function esTipoNotificacionConocido(tipo: string): tipo is TipoNotificacion {
  return (Object.keys(ESTILOS_POR_TIPO) as string[]).includes(tipo)
}

export function estiloNotificacion(tipo: string) {
  return esTipoNotificacionConocido(tipo) ? ESTILOS_POR_TIPO[tipo] : ESTILO_GENERICO
}

export function esTipoRecursoNotificacion(valor: string): valor is TipoRecursoNotificacion {
  return (TIPOS_RECURSO_NOTIFICACION as readonly string[]).includes(valor)
}

export type SeccionDestino = 'historial' | 'justificaciones'

export type DestinoNotificacionQuery = {
  alumnoId: string
  seccion: SeccionDestino
  recurso: TipoRecursoNotificacion
  recursoId: string
}

export const SECCION_POR_RECURSO: Record<TipoRecursoNotificacion, SeccionDestino> = {
  asistencia: 'historial',
  justificacion_individual: 'historial',
  solicitud_ausencia_periodo: 'justificaciones',
}

/**
 * Ruta del Portal Familia para abrir el recurso exacto de una notificación. Devuelve `null`
 * ante un destino nulo, incompleto o de un tipo que esta entrega todavía no conoce: nunca se
 * arma una URL arbitraria a partir de datos del backend.
 */
export function rutaDesdeDestino(destino: DestinoNotificacion | null | undefined): string | null {
  if (!destino) return null
  if (!esTipoRecursoNotificacion(destino.tipo)) return null
  if (!destino.id.trim() || !destino.alumno_id.trim()) return null

  const parametros = new URLSearchParams()
  parametros.set('alumno', destino.alumno_id)
  parametros.set('seccion', SECCION_POR_RECURSO[destino.tipo])
  parametros.set('recurso', destino.tipo)
  parametros.set('recurso_id', destino.id)

  return `/familia/asistencias?${parametros.toString()}`
}

/** Lee y valida los parámetros tipados que arma `rutaDesdeDestino`. */
export function leerDestinoDesdeParametros(
  parametros: Pick<URLSearchParams, 'get'>,
): DestinoNotificacionQuery | null {
  const alumnoId = parametros.get('alumno')?.trim() ?? ''
  const seccion = parametros.get('seccion')?.trim() ?? ''
  const recurso = parametros.get('recurso')?.trim() ?? ''
  const recursoId = parametros.get('recurso_id')?.trim() ?? ''

  if (!alumnoId || !recursoId) return null
  if (!esTipoRecursoNotificacion(recurso)) return null
  if (seccion !== 'historial' && seccion !== 'justificaciones') return null
  if (SECCION_POR_RECURSO[recurso] !== seccion) return null

  return { alumnoId, seccion, recurso, recursoId }
}

function claveDia(fecha: Date): string {
  return formatoClaveDia.format(fecha)
}

function fechaCorta(fecha: Date): string {
  const [dia, mes] = formatoMesCorto.format(fecha).split('-')
  return mes ? `${dia} ${mes}` : formatoMesCorto.format(fecha)
}

/**
 * Etiqueta corta y estable para el feed: minutos u horas si es reciente, día local si es de
 * hoy o ayer, y fecha corta para el resto. Se calcula en hora de Buenos Aires para que el
 * corte de "Hoy" coincida con el día operativo argentino.
 */
export function etiquetaTiempoNotificacion(iso: string, ahora: Date = new Date()): string {
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'

  const diferencia = Math.max(0, ahora.getTime() - fecha.getTime())
  const minutos = Math.floor(diferencia / 60_000)
  if (minutos < 1) return 'Ahora'
  if (minutos < 60) return `Hace ${minutos} min`

  const horas = Math.floor(minutos / 60)
  if (horas < 6) return `Hace ${horas} h`

  const dia = claveDia(fecha)
  if (dia === claveDia(ahora)) return `Hoy, ${formatoHora.format(fecha)}`

  const ayer = new Date(ahora.getTime() - 24 * 60 * 60 * 1000)
  if (dia === claveDia(ayer)) return 'Ayer'

  const anioFecha = formatoAnio.format(fecha)
  return anioFecha === formatoAnio.format(ahora)
    ? fechaCorta(fecha)
    : `${fechaCorta(fecha)} ${anioFecha}`
}
