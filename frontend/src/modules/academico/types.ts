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
