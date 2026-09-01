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

export type Asistencia = {
  id: string
  fecha: string
  tipo: TipoAsistencia
  inscripcion_id: string
  updated_at: string
}

export type AsistenciaCreate = {
  fecha: string
  tipo: TipoAsistencia
  inscripcion_id: string
}

export type AsistenciaUpdate = {
  tipo: TipoAsistencia
}

export type AsistenciaBulkRegistro = {
  inscripcion_id: string
  tipo: TipoAsistencia
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
