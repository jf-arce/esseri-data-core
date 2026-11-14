import type { ComandoBackend } from './types'
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

export const TECLA_ATAJO = 'i'

export const PREFIJO_API = '/asistente'

export const ETIQUETA_HERRAMIENTA: Record<string, string> = {
  indicadores_generales: 'Consultando indicadores',
  evolucion_financiera: 'Consultando la evolución financiera',
  deuda_por_familias: 'Consultando la deuda por familia',
  resumen_inscripciones: 'Consultando inscripciones',
  tendencia_asistencias: 'Consultando asistencias',
  ausentes_del_dia: 'Consultando los ausentes del día',
  estructura_academica: 'Consultando los cursos',
  alumnos_del_curso: 'Consultando los alumnos del curso',
  docentes_del_curso: 'Consultando los docentes del curso',
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

export type ComandoDeEntrada = {
  nombre: string
  descripcion: string
  /** Todos los permisos son necesarios; sin ellos el atajo no se lista. */
  permisos: string[]
  /** Texto que se inserta al elegirlo. Si termina en `@`, abre la lista de menciones. */
  plantilla: string
  /** Atajo que se manda al backend; `null` si se resuelve en el navegador (`/nueva`). */
  comando: ComandoBackend | null
}

/** Atajos del campo de texto (`/`). El backend vuelve a validar el permiso de cada herramienta. */
export const COMANDOS: ComandoDeEntrada[] = [
  {
    nombre: 'deuda',
    descripcion: 'Familias con mayor deuda vencida',
    permisos: [PERMISO_FACTURACION_LEER],
    plantilla: 'Familias con mayor deuda vencida',
    comando: 'deuda',
  },
  {
    nombre: 'asistencia',
    descripcion: 'Ausentes de hoy',
    permisos: [PERMISO_ACADEMICO_LEER],
    plantilla: 'Ausentes de hoy',
    comando: 'asistencia',
  },
  {
    nombre: 'horario',
    descripcion: 'Horario del curso que menciones con @',
    permisos: [PERMISO_ACADEMICO_LEER],
    plantilla: 'Horario de @',
    comando: 'horario',
  },
  {
    nombre: 'evolucion',
    descripcion: 'Facturado vs cobrado del año, con gráfico',
    permisos: [PERMISO_PANEL_ADMIN_LEER, PERMISO_FACTURACION_LEER],
    plantilla: 'Evolución de lo facturado y cobrado del año, con gráfico',
    comando: 'evolucion',
  },
  {
    nombre: 'comparar',
    descripcion: 'Evolución contra el período anterior',
    permisos: [PERMISO_PANEL_ADMIN_LEER, PERMISO_FACTURACION_LEER],
    plantilla: 'Evolución de lo facturado y cobrado del año, comparada con el período anterior',
    comando: 'comparar',
  },
  {
    nombre: 'ir',
    descripcion: 'Llevarte a una pantalla',
    permisos: [],
    plantilla: 'Llevame a ',
    comando: 'ir',
  },
  {
    nombre: 'nueva',
    descripcion: 'Empezar una conversación nueva',
    permisos: [],
    plantilla: '',
    comando: null,
  },
]
