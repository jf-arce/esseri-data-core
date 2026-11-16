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

export interface OpcionCampo {
  valor: string
  etiqueta: string
}

export interface CampoEvento {
  id: string
  nombre_interno: string
  etiqueta: string
  tipo_dato: TipoDato
  /** Valores cerrados del campo; `null` = campo libre. */
  opciones: OpcionCampo[] | null
  /** Demasiados valores para listarlos: se buscan por texto en el servidor. */
  busqueda: boolean
  /** Además de buscar, se puede escribir un valor a mano. */
  permite_otro: boolean
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
  /** `false` cuando la allowlist la declara pero todavía no tiene ejecutor. */
  implementada: boolean
  config_schema: Record<string, unknown>
}

export interface Condicion {
  campo: string
  operador: Operador
  valor: string | number
}

export type LogicaCondicion = 'todas' | 'alguna'

export interface GrupoCondicion {
  logica: LogicaCondicion
  comparaciones: Condicion[]
}

export type AccionConfig = Record<string, unknown>

export type TipoNodo = 'condicion' | 'accion'
export type RamaNodo = 'si' | 'no'

export interface PosicionNodo {
  x: number
  y: number
}

export interface DestinatariosNodo {
  roles: { id: string; nombre: string }[]
  usuarios: { id: string; email: string; estado: string }[]
}

/** Nodo del árbol tal como lo devuelve el backend. */
export interface NodoWorkflow {
  id: string
  tipo: TipoNodo
  /** `null` = cuelga del disparador. */
  padre_id: string | null
  rama: RamaNodo | null
  orden: number
  condicion: GrupoCondicion | null
  tipo_accion: TipoAccion | null
  accion_config: AccionConfig | null
  notificacion_template_id: string | null
  requiere_aprobacion_humana: boolean
  destinatarios: DestinatariosNodo
  posicion: PosicionNodo | null
  updated_at: string
}

/** Nodo tal como se envía al guardar: el `id` lo genera el editor. */
export interface NodoWorkflowPayload {
  id: string
  tipo: TipoNodo
  padre_id: string | null
  rama: RamaNodo | null
  condicion: GrupoCondicion | null
  tipo_accion: TipoAccion | null
  accion_config: AccionConfig | null
  notificacion_template_id: string | null
  requiere_aprobacion_humana: boolean | null
  destinatarios: { rol_ids: string[]; usuario_ids: string[] }
  posicion: PosicionNodo | null
}

export interface ReglaWorkflow {
  id: string
  nombre: string
  tipo_evento_id: string
  criticidad: Criticidad
  activo: boolean
  created_at: string
  updated_at: string
  nodos: NodoWorkflow[]
  /** Bloques del editor sin conectar al flujo: se guardan pero el motor no los ejecuta. */
  bloques_sueltos: unknown[]
}

export interface ReglaWorkflowCreatePayload {
  nombre: string
  tipo_evento_id: string
  criticidad: Criticidad
  activo: boolean
  nodos: NodoWorkflowPayload[]
  bloques_sueltos: unknown[]
}

export interface ReglaWorkflowPatch {
  nombre?: string
  tipo_evento_id?: string
  criticidad?: Criticidad
  activo?: boolean
  nodos?: NodoWorkflowPayload[]
  bloques_sueltos?: unknown[]
  /** `updated_at` de la regla al abrirla: si cambió, el guardado se rechaza (409). */
  updated_at_base?: string
}

export interface PlantillaNotificacion {
  id: string
  nombre: string
  asunto: string
  cuerpo: string
  created_at: string
  updated_at: string
}

export interface PlantillaPayload {
  nombre: string
  asunto: string
  cuerpo: string
}

export const ESTADOS_EJECUCION = ['exitoso', 'fallido', 'pendiente', 'rechazado'] as const
export type EstadoEjecucion = (typeof ESTADOS_EJECUCION)[number]

export interface CampoResumen {
  nombre_interno: string
  etiqueta: string
  /** Ya formateado por el backend (ej. "120.000,00"). */
  valor: string
}

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
  workflow_nodo_id: string
  /** `null` cuando la ejecución es de una condición que no se pudo evaluar. */
  tipo_accion: TipoAccion | null
  event_log_id: string
  tipo_evento: string
  evento_timestamp: string
  entidad: string
  entidad_id: string
  /** Calculado por el backend; el `POST` vuelve a validar al reintentar. */
  reintentable: boolean
  /** Calculado por el backend; el `POST` vuelve a validar al aprobar. */
  aprobable: boolean
  /** Datos del evento en el orden del catálogo, sin nulos ni campos reservados. */
  resumen_evento: CampoResumen[]
  /** Solo en el detalle de una penalidad pendiente: lo que se cobraría al aprobar hoy. */
  recargo_estimado: string | null
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
  reglaId?: string
  nodoId?: string
  pagina: number
  tamanioPagina: number
}

export const ESTADOS_ENVIO = ['enviado', 'fallido', 'pendiente'] as const
export type EstadoEnvio = (typeof ESTADOS_ENVIO)[number]

export const DESTINATARIOS_TIPO = ['familia', 'usuario'] as const
export type DestinatarioTipo = (typeof DESTINATARIOS_TIPO)[number]

export interface NotificacionEnviada {
  id: string
  destinatario_tipo: DestinatarioTipo
  canal: string
  destinatario_snapshot: string
  asunto_snapshot: string
  estado_envio: EstadoEnvio
  /** `null` si el envío no se concretó. */
  sent_at: string | null
  familia_id: string | null
  usuario_id: string | null
  workflow_execution_id: string
  intento: number
  ejecucion_started_at: string
  workflow_rule_id: string
  workflow_rule_nombre: string
}

/** El cuerpo solo viaja en el detalle: puede tener datos personales. */
export interface NotificacionEnviadaDetalle extends NotificacionEnviada {
  cuerpo_snapshot: string
}

export interface NotificacionEnviadaListado {
  items: NotificacionEnviada[]
  total: number
  pagina: number
  tamanio_pagina: number
  total_paginas: number
}

export interface FiltrosNotificaciones {
  estadoEnvio?: EstadoEnvio
  destinatarioTipo?: DestinatarioTipo
  pagina: number
  tamanioPagina: number
}

export const ESTADOS_TAREA = ['pendiente', 'en_progreso', 'completada', 'escalada'] as const
export type EstadoTarea = (typeof ESTADOS_TAREA)[number]

export const PRIORIDADES_TAREA = ['baja', 'media', 'alta'] as const
export type PrioridadTarea = (typeof PRIORIDADES_TAREA)[number]

export interface Tarea {
  id: string
  titulo: string
  descripcion: string | null
  estado: EstadoTarea
  prioridad: PrioridadTarea
  /** `null` si la tarea no vence. */
  fecha_vencimiento: string | null
  /** Calculado por el backend: abierta y con la fecha de vencimiento pasada. */
  vencida: boolean
  entidad: string | null
  entidad_id: string | null
  usuario_id: string
  usuario_email: string
  workflow_execution_id: string | null
  /** `null` cuando la tarea no la creó una regla. */
  workflow_rule_nombre: string | null
  /** La tarea de la que se escaló esta, si la hay. */
  tarea_id: string | null
  created_at: string
  updated_at: string
}

/** Un eslabón del historial de escalamiento. */
export interface TareaCadena {
  id: string
  titulo: string
  estado: EstadoTarea
  prioridad: PrioridadTarea
  usuario_email: string
  tarea_id: string | null
  created_at: string
}

export interface TareaDetalle extends Tarea {
  /** De la tarea original a la última escalada; incluye la tarea consultada. */
  cadena: TareaCadena[]
}

export interface TareaListado {
  items: Tarea[]
  total: number
  pagina: number
  tamanio_pagina: number
  total_paginas: number
}

export interface FiltrosTareas {
  estado?: EstadoTarea
  prioridad?: PrioridadTarea
  /** Responsable de la tarea; el backend lo ignora sin `workflows.leer` y con `soloMias`. */
  usuarioId?: string
  soloMias: boolean
  pagina: number
  tamanioPagina: number
}

/** Opción de una lista de selección única con buscador (`ComboboxBuscable`). */
export interface OpcionCombo {
  valor: string
  etiqueta: string
  /** Texto secundario (p. ej. el email) que también encuentra el buscador. */
  detalle?: string
  /** Las opciones con el mismo grupo se muestran juntas, bajo su título. */
  grupo?: string
}

export interface OpcionSelect {
  value: string
  label: string
}

// --- Simulación, estadísticas y resumen ----------------------------------------------------

export type EstadoNodoSimulado =
  | 'cumple'
  | 'no_cumple'
  | 'error'
  | 'alcanzada'
  | 'requiere_aprobacion'
  | 'diferida'
  | 'no_implementada'
  | 'config_invalida'
  | 'no_alcanzado'

export interface NodoSimulado {
  id: string
  estado: EstadoNodoSimulado
  detalle: string | null
}

export interface EventoResumen {
  id: string
  timestamp: string
  entidad: string
  estado: string
  campos: CampoResumen[]
}

export interface Simulacion {
  evento: EventoResumen
  nodos: NodoSimulado[]
}

export interface SimulacionPayload {
  tipo_evento_id: string
  event_log_id: string
  nodos: NodoWorkflowPayload[]
}

export interface ConteoEstados {
  exitoso: number
  fallido: number
  pendiente: number
  rechazado: number
  total: number
}

export interface EstadisticasNodo {
  workflow_nodo_id: string
  exitoso: number
  fallido: number
  pendiente: number
  rechazado: number
}

export interface EstadisticasRegla {
  dias: number
  nodos: EstadisticasNodo[]
}

export interface PuntoSerie extends ConteoEstados {
  fecha: string
}

export interface ResumenRegla {
  workflow_rule_id: string
  ejecuciones: ConteoEstados
  /** Ejecuciones por día de los últimos 14 días, del más viejo al más nuevo. */
  serie: number[]
  ultima_ejecucion: string | null
  fallas_7_dias: number
  sin_disparos: boolean
}

export interface ResumenWorkflows {
  dias: number
  actual: ConteoEstados
  anterior: ConteoEstados
  serie_diaria: PuntoSerie[]
  reglas: ResumenRegla[]
  activas: number
  inactivas: number
  con_errores: number
}
