// Contrato de la API de notificaciones internas. El `tipo` se deja como string porque la
// tabla es genérica: la UI conoce los tipos de las dos entregas y muestra un fallback para
// cualquier tipo futuro, sin romper el listado.
export const TIPOS_NOTIFICACION = [
  'academico.inasistencia_registrada',
  'academico.justificacion_aprobada',
  'academico.justificacion_rechazada',
  'comunicaciones.institucional_publicada',
  'facturacion.factura_emitida',
  'facturacion.pago_registrado',
  'facturacion.proximo_vencimiento',
  'facturacion.debito_exitoso',
  'facturacion.debito_rechazado',
] as const

export type TipoNotificacion = (typeof TIPOS_NOTIFICACION)[number]

export const TIPOS_RECURSO_NOTIFICACION = [
  'asistencia',
  'justificacion_individual',
  'solicitud_ausencia_periodo',
  'comunicacion',
  'factura',
  'pago',
] as const

export type TipoRecursoNotificacion = (typeof TIPOS_RECURSO_NOTIFICACION)[number]

export const TIPOS_RECURSO_ACADEMICO = [
  'asistencia',
  'justificacion_individual',
  'solicitud_ausencia_periodo',
] as const

export type TipoRecursoAcademico = (typeof TIPOS_RECURSO_ACADEMICO)[number]

export type DestinoNotificacion = {
  tipo: TipoRecursoNotificacion
  id: string
  alumno_id: string | null
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
