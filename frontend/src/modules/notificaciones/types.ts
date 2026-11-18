// Contrato de la API de notificaciones internas (S3 del ODD). El `tipo` se deja como string
// porque la tabla es genérica: la UI conoce los tipos académicos y muestra un fallback para
// cualquier tipo futuro, sin romper el listado.
export const TIPOS_NOTIFICACION = [
  'academico.inasistencia_registrada',
  'academico.justificacion_aprobada',
  'academico.justificacion_rechazada',
] as const

export type TipoNotificacion = (typeof TIPOS_NOTIFICACION)[number]

export const TIPOS_RECURSO_NOTIFICACION = [
  'asistencia',
  'justificacion_individual',
  'solicitud_ausencia_periodo',
] as const

export type TipoRecursoNotificacion = (typeof TIPOS_RECURSO_NOTIFICACION)[number]

export type DestinoNotificacion = {
  tipo: TipoRecursoNotificacion
  id: string
  alumno_id: string
}

export type NotificacionInterna = {
  id: string
  tipo: string
  titulo: string
  mensaje: string
  created_at: string
  leida_at: string | null
  destino: DestinoNotificacion | null
}

export type FiltroNotificaciones = 'todas' | 'no_leidas'

export type ListadoNotificaciones = {
  items: NotificacionInterna[]
  siguiente_cursor: string | null
  total_no_leidas: number
}

export type ResumenNotificaciones = {
  total_no_leidas: number
}

export type LecturaNotificacion = {
  id: string
  leida_at: string
}

export type ResultadoLecturas = {
  marcadas: number
}
