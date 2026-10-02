// Espejo de `backend/src/workflows/schemas.py` y `constants.py`.

export const TIPOS_ACCION = [
  'notificar',
  'alerta_interna',
  'cambiar_estado',
  'crear_tarea',
  'generar_cargo',
  'aplicar_vencimiento',
  'aplicar_penalidad',
  'registrar_pago',
  'registrar_rechazo',
  'actualizar_cuenta_corriente',
  'generar_recordatorio',
  'escalar_caso',
  'crear_registro_relacionado',
  'generar_orden_compra',
  'generar_comunicacion',
] as const
export type TipoAccion = (typeof TIPOS_ACCION)[number]

export const CRITICIDADES = ['baja', 'media', 'alta', 'critica'] as const
export type Criticidad = (typeof CRITICIDADES)[number]

export const OPERADORES = ['==', '!=', '>', '>=', '<', '<=', 'contiene'] as const
export type Operador = (typeof OPERADORES)[number]

export type TipoDato = 'numero' | 'fecha' | 'texto'

export interface CampoEvento {
  id: string
  nombre_interno: string
  etiqueta: string
  tipo_dato: TipoDato
}

export interface TipoEvento {
  id: string
  nombre: string
  descripcion: string | null
  campos: CampoEvento[]
}

export interface TipoAccionCatalogo {
  tipo_accion: TipoAccion
  requiere_aprobacion_por_defecto: boolean
  /** `null` = cualquier evento; lista vacía = todavía no se puede configurar. */
  eventos_permitidos: string[] | null
  admite_plantilla: boolean
  config_schema: Record<string, unknown>
}

export interface Condicion {
  campo: string
  operador: Operador
  valor: string | number
}

export type AccionConfig = Record<string, unknown>

export interface ReglaWorkflow {
  id: string
  nombre: string
  tipo_evento_id: string
  /** `{}` cuando la regla no tiene condición. */
  condicion: Partial<Condicion>
  tipo_accion: TipoAccion
  accion_config: AccionConfig | null
  criticidad: Criticidad
  requiere_aprobacion_humana: boolean
  notificacion_template_id: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

export interface ReglaWorkflowCreatePayload {
  nombre: string
  tipo_evento_id: string
  condicion: Partial<Condicion>
  tipo_accion: TipoAccion
  accion_config: AccionConfig
  criticidad: Criticidad
  requiere_aprobacion_humana: boolean
  activo: boolean
}

export interface ReglaWorkflowPatch {
  nombre?: string
  tipo_evento_id?: string
  condicion?: Partial<Condicion>
  tipo_accion?: TipoAccion
  accion_config?: AccionConfig | null
  criticidad?: Criticidad
  requiere_aprobacion_humana?: boolean
  notificacion_template_id?: string | null
  activo?: boolean
}

export const ESTADOS_EJECUCION = ['exitoso', 'fallido', 'pendiente'] as const
export type EstadoEjecucion = (typeof ESTADOS_EJECUCION)[number]

export interface EjecucionWorkflow {
  id: string
  intento: number
  started_at: string
  /** `null` mientras la ejecución sigue en curso. */
  finished_at: string | null
  estado: EstadoEjecucion
  detalle: string | null
  error_detail: string | null
  workflow_rule_id: string
  workflow_rule_nombre: string
  tipo_accion: TipoAccion
  event_log_id: string
  tipo_evento: string
  evento_timestamp: string
  entidad: string
  entidad_id: string
  /** Calculado por el backend; el `POST` vuelve a validar al reintentar. */
  reintentable: boolean
}

export interface EjecucionWorkflowListado {
  items: EjecucionWorkflow[]
  total: number
  pagina: number
  tamanio_pagina: number
  total_paginas: number
}

export interface FiltrosEjecuciones {
  estado?: EstadoEjecucion
  pagina: number
  tamanioPagina: number
}

export interface OpcionSelect {
  value: string
  label: string
}
