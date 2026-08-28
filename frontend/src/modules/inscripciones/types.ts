export type TipoInscripcionFormulario = 'nueva' | 'reinscripcion'

export interface SolicitudInscripcionOpcion {
  id: string
  ciclo_lectivo: string
  fecha_solicitud: string
  alumno_id: string
  alumno_nombre: string
  alumno_apellido: string
  numero_legajo: string
  nivel_educativo_id: string
  nivel_educativo_nombre: string
}

export interface DivisionOpcion {
  id: string
  nombre: string
  anio_numero: number
  nivel_educativo_id: string
  nivel_educativo_nombre: string
}

export interface AlumnoReinscripcionOpcion {
  alumno_id: string
  alumno_nombre: string
  alumno_apellido: string
  numero_legajo: string
  ciclo_anterior: string
}

export interface InscripcionRead {
  id: string
  ciclo_lectivo: string
  fecha_inscripcion: string
  tipo: 'nueva' | 'reinscripcion' | 'cambio_matricula' | 'baja'
  estado: 'activa' | 'finalizada' | 'baja'
  updated_at: string
  alumno_id: string
  division_id: string
  solicitud_inscripcion_id: string | null
}

export type TipoInscripcion = InscripcionRead['tipo']
export type EstadoInscripcion = InscripcionRead['estado']

export interface InscripcionListadoItem {
  id: string
  ciclo_lectivo: string
  fecha_inscripcion: string
  tipo: TipoInscripcion
  estado: EstadoInscripcion
  alumno_id: string
  alumno_nombre: string
  alumno_apellido: string
  numero_legajo: string
  division_id: string
  division_nombre: string
  anio_numero: number
  nivel_educativo_nombre: string
}

export interface InscripcionListado {
  items: InscripcionListadoItem[]
  total: number
  pagina: number
  tamanio_pagina: number
  total_paginas: number
}

export interface FiltrosInscripciones {
  buscar?: string
  cicloLectivo?: string
  estado?: EstadoInscripcion
  tipo?: TipoInscripcion
  pagina: number
  tamanioPagina: number
}

export interface CrearInscripcionPayload {
  ciclo_lectivo: string
  fecha_inscripcion: string
  alumno_id: string
  division_id: string
  solicitud_inscripcion_id: string
}

export interface CrearReinscripcionPayload {
  ciclo_lectivo: string
  fecha_inscripcion: string
  alumno_id: string
  division_id: string
}
