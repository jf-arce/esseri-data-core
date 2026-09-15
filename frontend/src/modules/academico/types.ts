import type { AccesoCreate, PersonaCreate } from '@/modules/auth/types'

export type NivelEducativo = {
  id: string
  nombre: string
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

export type Materia = {
  id: string
  nombre: string
  tipo: TipoMateria
  anio_id: string
  division_id: string | null
  created_at: string
  updated_at: string
}

export type MateriaCreate = {
  nombre: string
  tipo: TipoMateria
  anio_id: string
  division_id?: string | null
}

export type MateriaUpdate = {
  nombre?: string
  tipo?: TipoMateria
  anio_id?: string
  division_id?: string | null
}

export type Docente = {
  id: string
  legajo: string
  persona_id: string
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
}

export type AsignacionDocente = {
  id: string
  ciclo_lectivo: string
  docente_id: string
  materia_id: string
  division_id: string
  created_at: string
  updated_at: string
}

export type AsignacionDocenteCreate = {
  ciclo_lectivo: string
  docente_id: string
  materia_id: string
  division_id: string
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
}

export type AsistenciaFamilia = Asistencia & {
  justificacion_id: string | null
  justificacion_estado: 'pendiente' | 'aprobada' | 'rechazada' | null
  justificacion_motivo: string | null
  justificacion_observacion: string | null
  justificacion_archivo_nombre: string | null
}

export type JustificacionFamilia = {
  id: string
  asistencia_id: string
  estado: 'pendiente' | 'aprobada' | 'rechazada'
  motivo: string
  observacion: string | null
  archivo_nombre: string | null
  fecha_carga: string
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
  registros: AsistenciaBulkRegistro[]
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
