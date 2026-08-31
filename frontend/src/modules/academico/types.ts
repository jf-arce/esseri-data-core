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
