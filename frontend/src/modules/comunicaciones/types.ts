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
}
export interface Comunicacion {
  id: string
  clave: string | null
  asunto: string
  cuerpo: string
  estado: 'borrador' | 'publicada'
  audiencia: Audiencia | null
  autor_id: string
  created_at: string
  publicada_at: string | null
  destinatarios: number
  leida_at: string | null
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
