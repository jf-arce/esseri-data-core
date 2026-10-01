import type {
  AccionConfig,
  Condicion,
  Criticidad,
  Operador,
  ReglaWorkflow,
  ReglaWorkflowCreatePayload,
  ReglaWorkflowPatch,
  TipoAccion,
  TipoAccionCatalogo,
  TipoDato,
} from '@/modules/workflows/types'

export const ETIQUETA_ACCION: Record<TipoAccion, string> = {
  notificar: 'Notificar',
  alerta_interna: 'Alerta interna',
  cambiar_estado: 'Cambiar estado',
  crear_tarea: 'Crear tarea',
  generar_cargo: 'Generar cargo',
  aplicar_vencimiento: 'Aplicar vencimiento',
  aplicar_penalidad: 'Aplicar penalidad',
  registrar_pago: 'Registrar pago',
  registrar_rechazo: 'Registrar rechazo',
  actualizar_cuenta_corriente: 'Actualizar cuenta corriente',
  generar_recordatorio: 'Generar recordatorio',
  escalar_caso: 'Escalar caso',
  crear_registro_relacionado: 'Crear registro relacionado',
  generar_orden_compra: 'Generar orden de compra',
  generar_comunicacion: 'Generar comunicación',
}

export const ETIQUETA_CRITICIDAD: Record<Criticidad, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  critica: 'Crítica',
}

export const VARIANTE_CRITICIDAD: Record<Criticidad, 'neutro' | 'info' | 'advertencia' | 'error'> =
  { baja: 'neutro', media: 'info', alta: 'advertencia', critica: 'error' }

export const ETIQUETA_OPERADOR: Record<Operador, string> = {
  '==': 'es igual a',
  '!=': 'es distinto de',
  '>': 'es mayor que',
  '>=': 'es mayor o igual que',
  '<': 'es menor que',
  '<=': 'es menor o igual que',
  contiene: 'contiene',
}

// Réplica de `OPERADORES_POR_TIPO_DATO` en `backend/src/workflows/constants.py`: el catálogo de
// eventos no expone qué operadores admite cada tipo de dato.
export const OPERADORES_POR_TIPO_DATO: Record<TipoDato, readonly Operador[]> = {
  numero: ['==', '!=', '>', '>=', '<', '<='],
  fecha: ['==', '!=', '>', '>=', '<', '<='],
  texto: ['==', '!=', 'contiene'],
}

// Réplica de `CAMBIOS_ESTADO_PERMITIDOS` (por entidad) y `ENTIDAD_POR_EVENTO` en
// `backend/src/workflows/constants.py`, resuelta por nombre de evento.
export const ESTADOS_POR_EVENTO: Record<string, readonly string[]> = {
  'factura.vencida': ['vencida'],
}

export interface AccionDisponible {
  tipo_accion: TipoAccion
  disponible: boolean
  /** Por qué no se puede elegir; `null` cuando está disponible. */
  motivo: string | null
}

/** Qué acciones admite un evento según `eventos_permitidos`: `null` = cualquiera, lista vacía =
 * todavía no se puede configurar. Sin evento elegido no se bloquea ninguna. */
export function accionesDisponibles(
  tiposAccion: TipoAccionCatalogo[],
  nombreEvento: string | null,
): AccionDisponible[] {
  return tiposAccion.map(({ tipo_accion, eventos_permitidos }) => {
    if (eventos_permitidos === null || nombreEvento === null) {
      return { tipo_accion, disponible: true, motivo: null }
    }
    if (eventos_permitidos.length === 0) {
      return {
        tipo_accion,
        disponible: false,
        motivo: 'Todavía no se puede configurar: ningún evento la dispara.',
      }
    }
    if (!eventos_permitidos.includes(nombreEvento)) {
      return {
        tipo_accion,
        disponible: false,
        motivo: `No aplica a este evento. Eventos permitidos: ${eventos_permitidos.join(', ')}.`,
      }
    }
    return { tipo_accion, disponible: true, motivo: null }
  })
}

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/** Los `default` declarados en `properties` del JSON Schema de una acción, como texto de
 * formulario. Es lo único que se deriva del schema: los campos se arman a mano por acción. */
export function defaultsDeConfig(configSchema: Record<string, unknown>): Record<string, string> {
  const propiedades = configSchema.properties
  if (!esRegistro(propiedades)) return {}
  const defaults: Record<string, string> = {}
  for (const [nombre, propiedad] of Object.entries(propiedades)) {
    if (!esRegistro(propiedad)) continue
    const valor = propiedad.default
    if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') {
      defaults[nombre] = String(valor)
    }
  }
  return defaults
}

type TipoCampoConfig = 'texto' | 'entero' | 'decimal'

interface CampoConfig {
  nombre: string
  tipo: TipoCampoConfig
}

const texto = (nombre: string): CampoConfig => ({ nombre, tipo: 'texto' })
const entero = (nombre: string): CampoConfig => ({ nombre, tipo: 'entero' })
const decimal = (nombre: string): CampoConfig => ({ nombre, tipo: 'decimal' })

const CAMPOS_DESTINATARIO = [texto('destinatario')]

/** Campos de `accion_config` por acción (`CONFIG_POR_ACCION` del backend). */
export const CAMPOS_POR_ACCION: Record<TipoAccion, readonly CampoConfig[]> = {
  notificar: CAMPOS_DESTINATARIO,
  generar_comunicacion: CAMPOS_DESTINATARIO,
  generar_recordatorio: [texto('destinatario'), entero('dias_despues')],
  alerta_interna: [texto('mensaje')],
  crear_tarea: [
    texto('titulo'),
    texto('descripcion'),
    texto('prioridad'),
    entero('dias_para_vencer'),
  ],
  escalar_caso: [texto('motivo'), texto('prioridad')],
  cambiar_estado: [texto('estado_nuevo')],
  generar_cargo: [texto('concepto_cobro_id'), decimal('monto')],
  actualizar_cuenta_corriente: [texto('tipo'), texto('concepto_cobro_id'), texto('campo_monto')],
  aplicar_penalidad: [texto('regla_penalidad_id')],
  crear_registro_relacionado: [],
  aplicar_vencimiento: [],
  registrar_pago: [],
  registrar_rechazo: [],
  generar_orden_compra: [],
}

// Valores que el backend exige y que el usuario no elige (un solo valor posible).
const CONFIG_FIJA_POR_ACCION: Partial<Record<TipoAccion, AccionConfig>> = {
  crear_registro_relacionado: { registro: 'alumno_y_familia_desde_solicitud' },
}

// Campos de `accion_config` que dependen del evento: se limpian al cambiarlo.
export const CAMPOS_DEPENDIENTES_DEL_EVENTO = ['campo_monto', 'estado_nuevo'] as const

/** `accion_config` con solo los campos de esa acción y sin valores vacíos. Los enteros viajan
 * como número, `monto` como texto decimal (el backend lo lee como `Decimal`). */
export function armarConfig(tipoAccion: TipoAccion, valores: Record<string, string>): AccionConfig {
  const config: AccionConfig = { ...CONFIG_FIJA_POR_ACCION[tipoAccion] }
  for (const { nombre, tipo } of CAMPOS_POR_ACCION[tipoAccion]) {
    const valor = (valores[nombre] ?? '').trim()
    if (valor === '') continue
    if (tipo === 'entero') {
      const numero = Number(valor)
      if (Number.isFinite(numero)) config[nombre] = numero
    } else {
      config[nombre] = valor
    }
  }
  return config
}

/** Condición `{campo, operador, valor}`, o `{}` si no se eligió campo. En un campo numérico el
 * valor viaja como número real (el backend no convierte textos); si no es un número válido
 * viaja como texto y el backend lo rechaza con un mensaje claro. */
export function armarCondicion(
  campo: string,
  operador: Operador | '',
  valorTexto: string,
  tipoDato: TipoDato | null,
): Partial<Condicion> {
  if (campo === '' || operador === '') return {}
  const valor = valorTexto.trim()
  if (tipoDato === 'numero' && valor !== '' && Number.isFinite(Number(valor))) {
    return { campo, operador, valor: Number(valor) }
  }
  return { campo, operador, valor }
}

/** Estado del formulario del editor: todo como texto, igual que los inputs. */
export interface ValoresRegla {
  nombre: string
  tipoEventoId: string
  campoCondicion: string
  operadorCondicion: Operador | ''
  valorCondicion: string
  tipoAccion: TipoAccion | ''
  config: Record<string, string>
  criticidad: Criticidad
  requiereAprobacionHumana: boolean
  activo: boolean
}

export const VALORES_REGLA_VACIOS: ValoresRegla = {
  nombre: '',
  tipoEventoId: '',
  campoCondicion: '',
  operadorCondicion: '',
  valorCondicion: '',
  tipoAccion: '',
  config: {},
  criticidad: 'media',
  requiereAprobacionHumana: false,
  activo: true,
}

function esOperador(valor: unknown): valor is Operador {
  return (
    valor === '==' ||
    valor === '!=' ||
    valor === '>' ||
    valor === '>=' ||
    valor === '<' ||
    valor === '<=' ||
    valor === 'contiene'
  )
}

/** Carga una regla guardada en el formulario, respetando lo que tiene (incluida la aprobación
 * humana aunque difiera del default de la acción). */
export function valoresDesdeRegla(regla: ReglaWorkflow): ValoresRegla {
  const guardada = regla.accion_config ?? {}
  const config: Record<string, string> = {}
  for (const { nombre } of CAMPOS_POR_ACCION[regla.tipo_accion]) {
    const valor = guardada[nombre]
    if (typeof valor === 'string' || typeof valor === 'number') config[nombre] = String(valor)
  }
  const { campo, operador, valor } = regla.condicion
  return {
    nombre: regla.nombre,
    tipoEventoId: regla.tipo_evento_id,
    campoCondicion: campo ?? '',
    operadorCondicion: esOperador(operador) ? operador : '',
    valorCondicion: valor === undefined ? '' : String(valor),
    tipoAccion: regla.tipo_accion,
    config,
    criticidad: regla.criticidad,
    requiereAprobacionHumana: regla.requiere_aprobacion_humana,
    activo: regla.activo,
  }
}

export interface ContextoPayload {
  /** Tipo de dato del campo elegido en la condición. */
  tipoDatoCondicion: TipoDato | null
  /** Si la acción elegida admite `notificacion_template_id`. */
  admitePlantilla: boolean
}

export function armarPayloadAlta(
  valores: ValoresRegla,
  tipoAccion: TipoAccion,
  { tipoDatoCondicion }: ContextoPayload,
): ReglaWorkflowCreatePayload {
  return {
    nombre: valores.nombre.trim(),
    tipo_evento_id: valores.tipoEventoId,
    condicion: armarCondicion(
      valores.campoCondicion,
      valores.operadorCondicion,
      valores.valorCondicion,
      tipoDatoCondicion,
    ),
    tipo_accion: tipoAccion,
    accion_config: armarConfig(tipoAccion, valores.config),
    criticidad: valores.criticidad,
    requiere_aprobacion_humana: valores.requiereAprobacionHumana,
    activo: valores.activo,
  }
}

/** PATCH con reemplazo explícito de todo lo editable. Siempre manda la aprobación humana: sin
 * ella el backend la recalcularía al cambiar de acción. `notificacion_template_id` no se manda
 * (la regla conserva su plantilla) salvo que la nueva acción no admita plantilla. */
export function armarPatch(
  valores: ValoresRegla,
  tipoAccion: TipoAccion,
  contexto: ContextoPayload,
): ReglaWorkflowPatch {
  return {
    ...armarPayloadAlta(valores, tipoAccion, contexto),
    ...(contexto.admitePlantilla ? {} : { notificacion_template_id: null }),
  }
}

export type EstadoReglaFiltro = 'todos' | 'activas' | 'inactivas'

export function esEstadoReglaFiltro(valor: string): valor is EstadoReglaFiltro {
  return valor === 'todos' || valor === 'activas' || valor === 'inactivas'
}

export interface FiltrosReglas {
  busqueda: string
  estado: EstadoReglaFiltro
  /** `'todos'` o el id del tipo de evento. */
  tipoEventoId: string
}

export function filtrarReglas(reglas: ReglaWorkflow[], filtros: FiltrosReglas): ReglaWorkflow[] {
  const busqueda = filtros.busqueda.trim().toLocaleLowerCase('es-AR')
  return reglas.filter((regla) => {
    if (busqueda !== '' && !regla.nombre.toLocaleLowerCase('es-AR').includes(busqueda)) return false
    if (filtros.estado === 'activas' && !regla.activo) return false
    if (filtros.estado === 'inactivas' && regla.activo) return false
    return filtros.tipoEventoId === 'todos' || regla.tipo_evento_id === filtros.tipoEventoId
  })
}
