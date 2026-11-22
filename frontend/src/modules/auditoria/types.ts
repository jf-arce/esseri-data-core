export interface HistorialEntrada {
  id: string
  campo: string
  valor_anterior: string | null
  valor_nuevo: string | null
  fecha: string
  usuario_id: string
  usuario_email: string | null
  usuario_nombre: string | null
}

export type ActorTipo = 'usuario' | 'sistema'

export type OrdenAuditoria = 'fecha-desc' | 'fecha-asc'

/** Fila del listado global de AUDIT_LOG (espejo de `AuditoriaItemRead` del backend). */
export interface AuditoriaItem {
  id: string
  entidad: string
  entidad_id: string
  campo: string
  valor_anterior: string | null
  valor_nuevo: string | null
  fecha: string
  usuario_id: string | null
  usuario_email: string | null
  usuario_nombre: string | null
  actor_tipo: ActorTipo
  origen: string | null
  motivo: string | null
  referencia_entidad: string | null
  referencia_id: string | null
}

export interface AuditoriaListado {
  items: AuditoriaItem[]
  total: number
  pagina: number
  tamanio_pagina: number
  total_paginas: number
}

export interface FiltrosAuditoria {
  busqueda: string
  /** `FILTRO_TODOS` cuando no se restringe por entidad. */
  entidad: string
  campo: string
  usuarioId: string
  actorTipo: string
  origen: string
  /** Día ISO (YYYY-MM-DD) o '' si no se filtra. */
  desde: string
  hasta: string
  orden: OrdenAuditoria
  pagina: number
  tamanioPagina: number
}

export interface OpcionUsuarioAuditoria {
  id: string
  email: string
  nombre: string | null
}

export interface OpcionesAuditoria {
  entidades: string[]
  campos: string[]
  origenes: string[]
  usuarios: OpcionUsuarioAuditoria[]
}
