import type { AccesoCreate, PersonaCreate } from '@/modules/auth/types'

export type NivelEducativo = {
  id: string
  nombre: string
  cantidad_anios: number
  created_at: string
  updated_at: string
}

export type NivelEducativoCreate = {
  nombre: string
}

export type NivelEducativoUpdate = {
  nombre?: string
}

export type Anio = {
  id: string
  numero: number
  nivel_educativo_id: string
  cantidad_divisiones: number
  cantidad_materias: number
  created_at: string
  updated_at: string
}

export type AnioCreate = {
  numero: number
  nivel_educativo_id: string
}

export type AnioUpdate = {
  numero?: number
  nivel_educativo_id?: string
}

export type Division = {
  id: string
  nombre: string
  anio_id: string
  cantidad_materias: number
  cantidad_inscripciones: number
  cantidad_asignaciones: number
  created_at: string
  updated_at: string
}

export type DivisionCreate = {
  nombre: string
  anio_id: string
}

export type DivisionUpdate = {
  nombre?: string
  anio_id?: string
}

export type TipoMateria = 'materia' | 'taller'

/** Catálogo global de materias: se crea una sola vez y se asigna a distintos cursos. */
export type Materia = {
  id: string
  nombre: string
  tipo: TipoMateria
  cantidad_cursos: number
  created_at: string
  updated_at: string
}

export type MateriaCreate = {
  nombre: string
  tipo: TipoMateria
}

export type MateriaUpdate = {
  nombre?: string
  tipo?: TipoMateria
}

/** Franja horaria semanal de una materia en un curso. 1 = lunes, 7 = domingo. */
export type HorarioMateriaCurso = {
  id: string
  dia_semana: number
  hora_inicio: string
  hora_fin: string
}

export type HorarioMateriaCursoCreate = {
  dia_semana: number
  hora_inicio: string
  hora_fin: string
}

/** Materia del catálogo asignada a un curso (división), con sus franjas horarias. */
export type MateriaCurso = {
  id: string
  materia_id: string
  materia_nombre: string | null
  materia_tipo: TipoMateria | null
  division_id: string
  division_nombre: string | null
  anio_id: string | null
  anio_numero: number | null
  nivel_educativo_id: string | null
  nivel_educativo_nombre: string | null
  horarios: HorarioMateriaCurso[]
  cantidad_asignaciones: number
  created_at: string
  updated_at: string
}

export type MateriaCursoCreate = {
  /** Materia existente del catálogo, o `materia_nombre` para crearla en el momento. */
  materia_id?: string
  materia_nombre?: string
  materia_tipo?: TipoMateria
  division_id: string
  horarios: HorarioMateriaCursoCreate[]
}

export type MateriaCursoUpdate = {
  materia_id?: string
  horarios?: HorarioMateriaCursoCreate[]
}

export type Docente = {
  id: string
  legajo: string
  persona_id: string
  nombre?: string
  apellido?: string
  created_at: string
  updated_at: string
}

export type DocenteCreate = {
  legajo: string
  persona_id: string
}

export type DocenteUpdate = {
  legajo?: string
  persona_id?: string
}

/** Alta de un docente nuevo: crea Persona + Usuario (rol docente) + Docente juntos. */
export type AltaDocenteCreate = {
  persona: PersonaCreate
  acceso: AccesoCreate
  legajo: string
}

/** Suma el rol docente (y su ficha) a una cuenta que ya existe. */
export type DocenteDesdeUsuarioCreate = {
  usuario_id: string
  legajo: string
}

/** Una división asignada al docente autenticado (GET /academico/docentes/me/divisiones). */
export type MiDivision = {
  division_id: string
  etiqueta: string
  anio_numero: number
  nivel_educativo_nombre: string
  cantidad_materias: number
}

export type AsignacionDocente = {
  id: string
  ciclo_lectivo: string
  docente_id: string
  materia_curso_id: string
  materia_id?: string | null
  materia_nombre?: string | null
  division_id?: string | null
  division_nombre?: string | null
  horarios: HorarioMateriaCurso[]
  created_at: string
  updated_at: string
}

export type AsignacionDocenteCreate = {
  ciclo_lectivo: string
  docente_id: string
  materia_curso_id: string
}

export type AsignacionDocenteUpdate = {
  ciclo_lectivo?: string
  docente_id?: string
  materia_curso_id?: string
}

export type AsignacionDocenteBulkItem = {
  materia_curso_id: string
}

export type AsignacionDocenteBulkCreate = {
  ciclo_lectivo: string
  docente_id: string
  items: AsignacionDocenteBulkItem[]
}

export type AsignacionDocenteBulkResponse = {
  creadas: AsignacionDocente[]
  omitidas: AsignacionDocenteBulkItem[]
}

export type TipoAsistencia =
  'presente' | 'tardanza' | 'ausente_pendiente' | 'ausente_justificado' | 'ausente_injustificado'

// Lo único que el docente puede elegir al marcar asistencia. El backend traduce 'ausente' a
// 'ausente_pendiente' y dispara la notificación — nunca se manda un TipoAsistencia persistido
// (p. ej. 'ausente_justificado') como valor de entrada, el backend lo rechaza con 422.
export type TipoAsistenciaDocente = 'presente' | 'tardanza' | 'ausente'

export type Asistencia = {
  id: string
  fecha: string
  tipo: TipoAsistencia
  inscripcion_id: string
  updated_at: string
  justificacion_estado?: 'pendiente' | 'aprobada' | 'rechazada' | null
}

export type AsistenciaFamilia = Asistencia & {
  justificacion_id: string | null
  justificacion_estado: 'pendiente' | 'aprobada' | 'rechazada' | null
  justificacion_motivo: string | null
  justificacion_observacion: string | null
  justificacion_archivo_nombre: string | null
}

export type EstadoJustificacion = 'pendiente' | 'aprobada' | 'rechazada'

export type JustificacionFamilia = {
  id: string
  asistencia_id: string
  estado: EstadoJustificacion
  motivo: string
  observacion: string | null
  archivo_nombre: string | null
  fecha_carga: string
  fecha_asistencia: string
  alumno_nombre: string
  alumno_id?: string
  nivel_educativo_id?: string
  nivel_educativo_nombre?: string
  anio_id?: string
  anio_numero?: number
  division_id?: string
  division_nombre?: string
  fecha_resolucion?: string | null
}

export type EstadoSolicitudPeriodo =
  'pendiente' | 'aprobada' | 'rechazada' | 'cancelada' | 'revocada'

export type SolicitudAusenciaPeriodo = {
  id: string
  alumno_id: string
  fecha_inicio: string
  fecha_fin: string
  estado: EstadoSolicitudPeriodo
  motivo: string
  observacion: string | null
  observacion_resolucion: string | null
  archivo_nombre: string | null
  fecha_carga: string
  fecha_resolucion: string | null
}

export type JustificacionesResumen = {
  pendientes: number
  aprobadas: number
  rechazadas: number
  total: number
}

export type JustificacionesPaginadas = {
  items: JustificacionFamilia[]
  total: number
  pagina: number
  tamanio_pagina: number
  total_paginas: number
  resumen: JustificacionesResumen
}

export type OpcionJustificacion = {
  nivel_educativo_id: string
  nivel_educativo_nombre: string
  anio_id: string
  anio_numero: number
  division_id: string
  division_nombre: string
  alumno_id: string
  alumno_nombre: string
}

export type AsistenciaCreate = {
  fecha: string
  tipo: TipoAsistenciaDocente
  inscripcion_id: string
}

export type AsistenciaUpdate = {
  tipo: TipoAsistenciaDocente
}

export type AsistenciaBulkRegistro = {
  inscripcion_id: string
  tipo: TipoAsistenciaDocente
}

export type AsistenciaBulkCreate = {
  fecha: string
  division_id: string
  ciclo_lectivo?: string
  registros: AsistenciaBulkRegistro[]
}

export type SeguimientoDivisionItem = {
  inscripcion_id: string
  total_ausencias: number
  ausencias_consecutivas: number
  inasistencia_reiterada: boolean
}

export type AsistenciaBulkResponse = {
  creadas: number
  actualizadas: number
  notificaciones_disparadas: number
}

/** Resumen de asistencia de una inscripción en un período (RF-06): conteos por tipo y
 * porcentajes ya calculados por el backend, en escala 0-100. */
export type AsistenciaResumen = {
  inscripcion_id: string
  alumno_id: string
  fecha_desde: string
  fecha_hasta: string
  total_registros: number
  presentes: number
  tardanzas: number
  ausentes_pendientes: number
  ausentes_justificadas: number
  ausentes_injustificadas: number
  porcentaje_presencia: number
  porcentaje_justificadas: number
  porcentaje_injustificadas: number
}
