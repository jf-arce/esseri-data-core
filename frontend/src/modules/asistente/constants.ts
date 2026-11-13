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
  ficha_alumno: 'Consultando la ficha del alumno',
  tareas_y_ejecuciones_pendientes: 'Consultando tareas y ejecuciones',
  buscar_recurso: 'Buscando',
  ir_a: 'Preparando la navegación',
}
