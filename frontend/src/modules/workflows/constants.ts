import type { OpcionSelect } from '@/modules/workflows/types'

// --- Rutas del frontend ---------------------------------------------------------------------

export const RUTA_REGLAS = '/workflows/reglas'
export const RUTA_NUEVA_REGLA = `${RUTA_REGLAS}/nueva`
export const PARAMETRO_REGLA_ID = 'reglaId'
export const RUTA_REGLA_POR_ID = `${RUTA_REGLAS}/:${PARAMETRO_REGLA_ID}`

export function rutaRegla(id: string): string {
  return `${RUTA_REGLAS}/${id}`
}

export const RUTA_EJECUCIONES = '/workflows/ejecuciones'

// --- Endpoints del backend (`backend/src/workflows/router.py`) -------------------------------

export const API_REGLAS = '/workflows/reglas'
export const API_TIPOS_EVENTO = '/workflows/tipos-evento'
export const API_TIPOS_ACCION = '/workflows/tipos-accion'
export const API_PLANTILLAS = '/workflows/plantillas'

export function apiRegla(id: string): string {
  return `${API_REGLAS}/${id}`
}

export function apiPlantilla(id: string): string {
  return `${API_PLANTILLAS}/${id}`
}

export function apiDestinatariosRegla(id: string): string {
  return `${apiRegla(id)}/destinatarios`
}

export const API_EJECUCIONES = '/workflows/ejecuciones'

export function apiReintentarEjecucion(id: string): string {
  return `${API_EJECUCIONES}/${id}/reintentar`
}

// --- Listado --------------------------------------------------------------------------------

export const LOCALE = 'es-AR'
/** Valor del filtro que no restringe nada. */
export const FILTRO_TODOS = 'todos'
export const FILTRO_ACTIVAS = 'activas'
export const FILTRO_INACTIVAS = 'inactivas'
export const ESTADOS_REGLA_FILTRO = [FILTRO_TODOS, FILTRO_ACTIVAS, FILTRO_INACTIVAS] as const
export const ESTADOS_EJECUCION_FILTRO = [FILTRO_TODOS, 'exitoso', 'fallido', 'pendiente'] as const
export const TAMANIO_PAGINA_EJECUCIONES = 20

// --- accion_config --------------------------------------------------------------------------

/** Claves de `accion_config` (`backend/src/workflows/schemas.py`). */
export const CLAVE_CONFIG = {
  destinatario: 'destinatario',
  diasDespues: 'dias_despues',
  mensaje: 'mensaje',
  titulo: 'titulo',
  descripcion: 'descripcion',
  prioridad: 'prioridad',
  diasParaVencer: 'dias_para_vencer',
  motivo: 'motivo',
  estadoNuevo: 'estado_nuevo',
  conceptoCobroId: 'concepto_cobro_id',
  monto: 'monto',
  tipo: 'tipo',
  campoMonto: 'campo_monto',
  reglaPenalidadId: 'regla_penalidad_id',
  registro: 'registro',
} as const

/** Único valor que admite `crear_registro_relacionado.registro`. */
export const REGISTRO_ALUMNO_Y_FAMILIA = 'alumno_y_familia_desde_solicitud'

// Límites que valida el backend (mismos valores que `schemas.py`).
export const LIMITE_NOMBRE_REGLA = 150
export const LIMITE_NOMBRE_PLANTILLA = 150
export const LIMITE_ASUNTO_PLANTILLA = 200
export const LIMITE_CUERPO_PLANTILLA = 10_000
export const LIMITE_MENSAJE_ALERTA = 500
export const LIMITE_TITULO_TAREA = 150
export const RANGO_DIAS_RECORDATORIO = { min: 1, max: 90 }
export const RANGO_DIAS_TAREA = { min: 1, max: 60 }
export const RANGO_MONTO = { min: 0.01, step: '0.01' }

/** Estado con el que el backend marca a un usuario habilitado (`Usuario.estado`). */
export const ESTADO_USUARIO_ACTIVO = 'activo'

/** Valor de `accion_config.destinatario` que toma los destinatarios cargados en la regla. */
export const DESTINATARIO_REGLA = 'destinatarios_regla'

// Vocabularios cerrados del backend (`Destinatario`, `PrioridadTarea`, `Literal["debe", "haber"]`).
export const DESTINATARIOS: OpcionSelect[] = [
  { value: 'responsable_economico', label: 'Responsable económico' },
  { value: 'responsables_habilitados', label: 'Responsables habilitados' },
  { value: DESTINATARIO_REGLA, label: 'Destinatarios de la regla' },
]
export const PRIORIDADES: OpcionSelect[] = [
  { value: 'baja', label: 'Baja' },
  { value: 'media', label: 'Media' },
  { value: 'alta', label: 'Alta' },
]
export const TIPOS_ASIENTO: OpcionSelect[] = [
  { value: 'debe', label: 'Debe' },
  { value: 'haber', label: 'Haber' },
]
