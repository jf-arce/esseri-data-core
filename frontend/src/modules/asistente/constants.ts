import {
  PERMISO_ACADEMICO_LEER,
  PERMISO_FACTURACION_LEER,
  PERMISO_INSCRIPCIONES_LEER,
  PERMISO_PANEL_ADMIN_LEER,
} from '@/modules/auth/constants'

export const ANCHO_MINIMO_PANEL = 340
export const ANCHO_MAXIMO_PANEL = 640
export const ANCHO_INICIAL_PANEL = 400
export const PASO_TECLADO_ANCHO = 24
export const CLAVE_ALMACENAMIENTO = 'esseri.asistente'

/** Atajo para abrir y cerrar el panel (Ctrl o ⌘ + I). */
export const TECLA_ATAJO = 'i'

export const PREFIJO_API = '/asistente'

/** Qué se está consultando mientras corre cada herramienta del backend. */
export const ETIQUETA_HERRAMIENTA: Record<string, string> = {
  indicadores_generales: 'Consultando indicadores',
  evolucion_financiera: 'Consultando la evolución financiera',
  deuda_por_familias: 'Consultando la deuda por familia',
  resumen_inscripciones: 'Consultando inscripciones',
  tendencia_asistencias: 'Consultando asistencias',
  ausentes_del_dia: 'Consultando los ausentes del día',
  horario_del_curso: 'Consultando los horarios del curso',
  ficha_alumno: 'Consultando la ficha del alumno',
  tareas_y_ejecuciones_pendientes: 'Consultando tareas y ejecuciones',
  buscar_recurso: 'Buscando',
  ir_a: 'Preparando el acceso',
}

/** Preguntas de arranque del estado vacío; cada una se ofrece solo a quien puede ver esos datos. */
export const SUGERENCIAS: { texto: string; permiso: string }[] = [
  { texto: '¿Cómo viene la deuda por familia?', permiso: PERMISO_FACTURACION_LEER },
  { texto: '¿Cómo vienen las asistencias?', permiso: PERMISO_ACADEMICO_LEER },
  { texto: '¿Cuántas inscripciones hay este ciclo?', permiso: PERMISO_INSCRIPCIONES_LEER },
  { texto: 'Mostrame los indicadores generales', permiso: PERMISO_PANEL_ADMIN_LEER },
]
