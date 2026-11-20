import {
  AlignLeftIcon,
  CalendarClockIcon,
  ChartColumnIcon,
  CornerDownRightIcon,
  GitCompareArrowsIcon,
  PlusIcon,
  TrendingUpIcon,
  UserCheckIcon,
  WalletIcon,
  type LucideIcon,
} from 'lucide-react'
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

/** Cuánto dura el "Copiado" después de copiar una respuesta o una tabla. */
export const MS_FEEDBACK_COPIA = 1500

/** Filas de una tabla del chat que se ven sin scroll; con más, la tabla scrollea por dentro. */
export const FILAS_VISIBLES_TABLA = 6
/** Alto de una fila (`h-10`) y del encabezado, para calcular el alto máximo de la tabla. */
export const ALTO_FILA_TABLA = 40

export const TECLA_ATAJO = 'i'

export const PREFIJO_API = '/asistente'

export const ETIQUETA_HERRAMIENTA: Record<string, string> = {
  indicadores_generales: 'Consultando indicadores',
  evolucion_financiera: 'Consultando la evolución financiera',
  deuda_por_familias: 'Consultando la deuda por familia',
  estado_de_cuenta_familia: 'Consultando el estado de cuenta',
  facturas: 'Consultando las facturas',
  resumen_cobros: 'Consultando los cobros',
  resumen_debitos: 'Consultando los débitos',
  lotes_debito: 'Consultando los lotes de débito',
  facturas_para_debitar: 'Consultando las facturas a debitar',
  resumen_inscripciones: 'Consultando inscripciones',
  tendencia_asistencias: 'Consultando asistencias',
  ausentes_del_dia: 'Consultando los ausentes del día',
  alumnos_con_mas_inasistencias: 'Consultando las inasistencias por alumno',
  asistencia_por_curso: 'Consultando la asistencia por curso',
  resumen_justificaciones: 'Consultando las justificaciones',
  justificaciones_pendientes: 'Consultando las justificaciones pendientes',
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
  icono: LucideIcon
  /** Lo que se manda si después del atajo no se escribe nada. */
  preguntaPorDefecto: string
  /** Sin texto no hay qué consultar: hay que escribir algo después del atajo. */
  requiereTexto: boolean
  /** Al elegirlo se abre la lista de menciones (`/horario`: el curso se elige con `@`). */
  abreMenciones?: boolean
  /** Atajo que se manda al backend; `null` si se resuelve en el navegador (`/nueva`). */
  comando: ComandoBackend | null
}

/** Atajos del campo de texto (`/`). El backend vuelve a validar el permiso de cada herramienta. */
export const COMANDOS: ComandoDeEntrada[] = [
  {
    nombre: 'deuda',
    descripcion: 'Familias con mayor deuda vencida',
    permisos: [PERMISO_FACTURACION_LEER],
    icono: WalletIcon,
    preguntaPorDefecto: 'Familias con mayor deuda vencida',
    requiereTexto: false,
    comando: 'deuda',
  },
  {
    nombre: 'asistencia',
    descripcion: 'Ausentes de hoy',
    permisos: [PERMISO_ACADEMICO_LEER],
    icono: UserCheckIcon,
    preguntaPorDefecto: 'Ausentes de hoy',
    requiereTexto: false,
    comando: 'asistencia',
  },
  {
    nombre: 'horario',
    descripcion: 'Horario del curso que menciones con @',
    permisos: [PERMISO_ACADEMICO_LEER],
    icono: CalendarClockIcon,
    preguntaPorDefecto: 'Horario del curso',
    requiereTexto: false,
    abreMenciones: true,
    comando: 'horario',
  },
  {
    nombre: 'evolucion',
    descripcion: 'Facturado vs cobrado del año, con gráfico',
    permisos: [PERMISO_PANEL_ADMIN_LEER, PERMISO_FACTURACION_LEER],
    icono: TrendingUpIcon,
    preguntaPorDefecto: 'Evolución de lo facturado y cobrado del año, con gráfico',
    requiereTexto: false,
    comando: 'evolucion',
  },
  {
    nombre: 'comparar',
    descripcion: 'Compara con el período anterior, en cualquier módulo',
    permisos: [],
    icono: GitCompareArrowsIcon,
    preguntaPorDefecto: '',
    requiereTexto: true,
    comando: 'comparar',
  },
  {
    nombre: 'grafico',
    descripcion: 'Muestra el resultado como gráfico, en cualquier módulo',
    permisos: [],
    icono: ChartColumnIcon,
    preguntaPorDefecto: '',
    requiereTexto: true,
    comando: 'grafico',
  },
  {
    nombre: 'resumen',
    descripcion: 'Responde en una frase, sin tablas ni gráficos',
    permisos: [],
    icono: AlignLeftIcon,
    preguntaPorDefecto: '',
    requiereTexto: true,
    comando: 'resumen',
  },
  {
    nombre: 'ir',
    descripcion: 'Llevarte a una pantalla',
    permisos: [],
    icono: CornerDownRightIcon,
    preguntaPorDefecto: '',
    requiereTexto: true,
    comando: 'ir',
  },
  {
    nombre: 'nueva',
    descripcion: 'Empezar una conversación nueva',
    permisos: [],
    icono: PlusIcon,
    preguntaPorDefecto: '',
    requiereTexto: false,
    comando: null,
  },
]

/** Cuántos alumnos, familias, docentes o cursos se pueden tener fijados a la vez. */
export const MAX_FIJADOS = 10
