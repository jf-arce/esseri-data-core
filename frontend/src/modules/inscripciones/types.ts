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

export interface CambioMatriculaPayload {
  division_id: string
  fecha_cambio: string
}

export interface BajaInscripcionPayload {
  fecha_baja: string
}

export type EtapaSolicitudAdmision =
  | 'consulta_lead'
  | 'entrevista'
  | 'postulacion'
  | 'evaluacion_aprobacion'
  | 'reserva_matricula'
  | 'documentacion_contrato'
  | 'inscripcion_confirmada'

export type EstadoSolicitudAdmision = 'en_proceso' | 'aprobada' | 'rechazada' | 'desistida'

export interface EtapaSolicitudAdmisionItem {
  id: string
  etapa: EtapaSolicitudAdmision
  estado: 'en_proceso' | 'completada' | 'rechazada'
  fecha: string
  observaciones: string | null
  usuario_id: string
}

export interface DocumentoSolicitudAdmision {
  id: string
  tipo_documento: string
  archivo: string
  estado: 'pendiente' | 'validado' | 'rechazado'
  fecha_carga: string
  updated_at: string
  usuario_id: string
}

export interface SolicitudAdmisionListadoItem {
  id: string
  ciclo_lectivo: string
  etapa: EtapaSolicitudAdmision
  estado: EstadoSolicitudAdmision
  fecha_solicitud: string
  aspirante_nombre: string
  aspirante_apellido: string
  aspirante_dni: string
  nivel_educativo_nombre: string
}

export interface SolicitudesAdmisionListado {
  items: SolicitudAdmisionListadoItem[]
  total: number
  pagina: number
  tamanio_pagina: number
  total_paginas: number
}

export interface SolicitudAdmision {
  id: string
  ciclo_lectivo: string
  etapa: EtapaSolicitudAdmision
  estado: EstadoSolicitudAdmision
  fecha_solicitud: string
  fecha_resolucion: string | null
  observaciones: string | null
  updated_at: string
  nivel_educativo_id: string
  aspirante: {
    id: string
    nombre: string
    apellido: string
    dni: string
    telefono: string | null
    sexo: string | null
  }
  contacto: {
    id: string
    nombre: string
    apellido: string
    dni: string
    telefono: string | null
    sexo: string | null
  } | null
  usuario_id: string
  etapas: EtapaSolicitudAdmisionItem[]
  documentos: DocumentoSolicitudAdmision[]
}

export interface FiltrosSolicitudesAdmision {
  buscar?: string
  estado?: EstadoSolicitudAdmision
  etapa?: EtapaSolicitudAdmision
  pagina: number
  tamanioPagina: number
}
