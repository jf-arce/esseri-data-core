export type Canal = 'portal' | 'email' | 'ambos'
export type TipoComunicacion = 'institucional' | 'curso' | 'administrativa' | 'otro'

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

export type FiltroEntrega =
  | 'todos'
  | 'con_email'
  | 'sin_email'
  | 'enviados'
  | 'pendientes'
  | 'fallidos'
  | 'inciertos'
  | 'leidos'
  | 'no_leidos'

export interface ContactoEntrega {
  id: string
  email: string
}

export interface ResponsableEntrega {
  id: string
  nombre: string
  emails: Envio[]
  contactos?: ContactoEntrega[]
  leida_at: string | null
}

export interface ResumenEntrega {
  responsables: number
  responsables_con_email: number
  responsables_sin_email: number
  responsables_leidos: number
  responsables_no_leidos: number
  emails: number
  emails_aceptados: number
  emails_pendientes: number
  emails_fallidos: number
  emails_inciertos: number
  email_aplica: boolean
  lectura_aplica: boolean
}

export interface ListadoEntrega {
  items: ResponsableEntrega[]
  resumen: ResumenEntrega
  total: number
  pagina: number
  total_paginas: number
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
  tipo?: TipoComunicacion
}
export interface Comunicacion {
  id: string
  clave: string | null
  asunto: string
  cuerpo: string
  tipo: TipoComunicacion
  emisor: string | null
  estado: 'borrador' | 'publicada'
  audiencia: Audiencia | null
  autor_id: string
  autor_nombre?: string | null
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
