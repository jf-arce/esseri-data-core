export type Canal = 'portal' | 'email' | 'ambos'

export type EstadoAdjunto = 'cuarentena' | 'limpio' | 'rechazado' | 'error'

export interface Adjunto {
  id: string
  nombre: string
  tipo_contenido: string
  tamanio: number
  estado: EstadoAdjunto
}

export interface IntentoEnvio {
  id: string
  estado: string
  error_codigo: string | null
  started_at: string | null
  finished_at: string | null
}

export interface Envio {
  id: string
  email: string | null
  estado: string
  intentos: IntentoEnvio[]
}

export interface Audiencia {
  tipo: 'todos' | 'nivel' | 'division' | 'alumnos' | 'responsables'
  ids: string[]
  ciclo_lectivo?: string | null
}
export interface Borrador {
  clave: string
  asunto: string
  cuerpo: string
  audiencia: Audiencia
  canal?: Canal
}
export interface Comunicacion {
  id: string
  clave: string | null
  asunto: string
  cuerpo: string
  tipo: 'institucional' | 'curso'
  emisor: string | null
  estado: 'borrador' | 'publicada'
  audiencia: Audiencia | null
  autor_id: string
  created_at: string
  publicada_at: string | null
  destinatarios: number
  leida_at: string | null
  canal: Canal
  adjuntos?: Adjunto[]
}
export interface Listado {
  items: Comunicacion[]
  total: number
  pagina: number
  total_paginas: number
}
export interface Opcion {
  id: string
  nombre: string
}
export interface Opciones {
  alumnos: Opcion[]
  responsables: Opcion[]
  niveles: Opcion[]
  divisiones: Opcion[]
  ciclos: string[]
}
