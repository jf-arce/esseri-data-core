import type { UsuarioConRoles } from '@/modules/auth/types'
import { nombreVisibleDeUsuario } from '@/modules/auth/utils'
import {
  CLAVE_CONFIG,
  DESTINATARIO_REGLA,
  DESTINATARIOS_TIPO_FILTRO,
  ESTADOS_EJECUCION_FILTRO,
  ESTADOS_ENVIO_FILTRO,
  ESTADOS_TAREA_FILTRO,
  ESTADOS_REGLA_FILTRO,
  FILTRO_ACTIVAS,
  FILTRO_INACTIVAS,
  FILTRO_TODOS,
  LOCALE,
  PRIORIDADES_TAREA_FILTRO,
  REGISTRO_ALUMNO_Y_FAMILIA,
} from '@/modules/workflows/constants'
import type {
  CampoResumen,
  AccionConfig,
  CampoEvento,
  Condicion,
  Criticidad,
  DestinatarioTipo,
  EstadoEjecucion,
  EstadoEnvio,
  EstadoTarea,
  Operador,
  OpcionCombo,
  PrioridadTarea,
  ReglaWorkflow,
  ReglaWorkflowCreatePayload,
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

// Cómo se nombra cada evento del catálogo (`TipoEventoNombre` en el backend) frente al usuario.
// Un evento nuevo sin entrada acá se muestra con su nombre interno.
const ETIQUETA_EVENTO: Record<string, string> = {
  'inasistencia.registrada': 'Se registra una inasistencia',
  'inasistencia.justificada': 'Se justifica una inasistencia',
  'factura.vencida': 'Vence una factura',
  'inscripcion.cambio_matricula': 'Cambia la matrícula de una inscripción',
  'solicitud_inscripcion.aprobada': 'Se aprueba una solicitud de inscripción',
  'pago.registrado': 'Se registra un pago',
  'pago.rechazado': 'Se rechaza un pago',
  'orden_compra.emitida': 'Se emite una orden de compra',
  'recepcion_compra.registrada': 'Se registra una recepción de compra',
  'solicitud_compra.aprobada': 'Se aprueba una solicitud de compra',
  'inscripcion.confirmada': 'Se confirma una inscripción',
}

export function etiquetaEvento(nombre: string): string {
  return ETIQUETA_EVENTO[nombre] ?? nombre
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
        motivo: `No aplica a este evento. Se usa cuando: ${eventos_permitidos
          .map(etiquetaEvento)
          .join('; ')}.`,
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

const CAMPOS_DESTINATARIO = [texto(CLAVE_CONFIG.destinatario)]
const CAMPO_ENLACE = texto(CLAVE_CONFIG.enlace)

/** Campos de `accion_config` por acción (`CONFIG_POR_ACCION` del backend). */
export const CAMPOS_POR_ACCION: Record<TipoAccion, readonly CampoConfig[]> = {
  notificar: [...CAMPOS_DESTINATARIO, CAMPO_ENLACE],
  generar_comunicacion: CAMPOS_DESTINATARIO,
  generar_recordatorio: [
    texto(CLAVE_CONFIG.destinatario),
    entero(CLAVE_CONFIG.diasDespues),
    CAMPO_ENLACE,
  ],
  alerta_interna: [texto(CLAVE_CONFIG.mensaje), CAMPO_ENLACE],
  crear_tarea: [
    texto(CLAVE_CONFIG.titulo),
    texto(CLAVE_CONFIG.descripcion),
    texto(CLAVE_CONFIG.prioridad),
    entero(CLAVE_CONFIG.diasParaVencer),
  ],
  escalar_caso: [texto(CLAVE_CONFIG.motivo), texto(CLAVE_CONFIG.prioridad)],
  cambiar_estado: [texto(CLAVE_CONFIG.estadoNuevo)],
  generar_cargo: [texto(CLAVE_CONFIG.conceptoCobroId), decimal(CLAVE_CONFIG.monto)],
  actualizar_cuenta_corriente: [
    texto(CLAVE_CONFIG.tipo),
    texto(CLAVE_CONFIG.conceptoCobroId),
    texto(CLAVE_CONFIG.campoMonto),
  ],
  aplicar_penalidad: [texto(CLAVE_CONFIG.reglaPenalidadId)],
  crear_registro_relacionado: [],
  aplicar_vencimiento: [],
  registrar_pago: [],
  registrar_rechazo: [],
  generar_orden_compra: [],
}

// Valores que el backend exige y que el usuario no elige (un solo valor posible).
const CONFIG_FIJA_POR_ACCION: Partial<Record<TipoAccion, AccionConfig>> = {
  crear_registro_relacionado: { [CLAVE_CONFIG.registro]: REGISTRO_ALUMNO_Y_FAMILIA },
}

// Campos de `accion_config` que dependen del evento: se limpian al cambiarlo.
export const CAMPOS_DEPENDIENTES_DEL_EVENTO = [
  CLAVE_CONFIG.campoMonto,
  CLAVE_CONFIG.estadoNuevo,
] as const

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
  /** Id de la plantilla elegida, o `''` si no hay. */
  plantillaId: string
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
  plantillaId: '',
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
    plantillaId: regla.notificacion_template_id ?? '',
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

/** Payload completo de la regla, igual para el alta y el PATCH (reemplazo explícito de todo lo
 * editable). Siempre manda la aprobación humana: sin ella el backend la recalcularía al cambiar
 * de acción. */
export function armarPayloadRegla(
  valores: ValoresRegla,
  tipoAccion: TipoAccion,
  { tipoDatoCondicion, admitePlantilla }: ContextoPayload,
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
    notificacion_template_id:
      admitePlantilla && valores.plantillaId !== '' ? valores.plantillaId : null,
    activo: valores.activo,
  }
}

const ACCIONES_CON_DESTINATARIO_ELEGIBLE: readonly TipoAccion[] = [
  'notificar',
  'generar_recordatorio',
  'generar_comunicacion',
]

/** Acciones que siempre usan los destinatarios de la regla: avisan (`alerta_interna`) o asignan el
 * trabajo (`crear_tarea`, `escalar_caso`) a esas personas. */
const ACCIONES_CON_DESTINATARIOS_FIJOS: readonly TipoAccion[] = [
  'alerta_interna',
  'crear_tarea',
  'escalar_caso',
]

/** Réplica de `config_admite_destinatarios` del backend: las acciones de destinatarios fijos
 * siempre, y las demás acciones con plantilla solo si el destinatario es "Destinatarios de la
 * regla". */
export function admiteDestinatarios(tipoAccion: TipoAccion | '', config: Record<string, string>) {
  if (tipoAccion === '') return false
  if (ACCIONES_CON_DESTINATARIOS_FIJOS.includes(tipoAccion)) return true
  return (
    ACCIONES_CON_DESTINATARIO_ELEGIBLE.includes(tipoAccion) &&
    config[CLAVE_CONFIG.destinatario] === DESTINATARIO_REGLA
  )
}

/** A quiénes se asigna el trabajo, para rotular el selector de destinatarios. */
export function asignaTareas(tipoAccion: TipoAccion | ''): boolean {
  return tipoAccion === 'crear_tarea' || tipoAccion === 'escalar_caso'
}

/** Inserta `{{campo}}` en `posicion` y devuelve el texto nuevo y dónde queda el cursor. */
export function insertarPlaceholder(texto: string, posicion: number, nombreCampo: string) {
  const inicio = Math.min(Math.max(posicion, 0), texto.length)
  const placeholder = `{{${nombreCampo}}}`
  return {
    texto: texto.slice(0, inicio) + placeholder + texto.slice(inicio),
    posicion: inicio + placeholder.length,
  }
}

const PLACEHOLDER = /\{\{([a-z][a-z0-9_]*)\}\}/g
const ERROR_FORMATO_PLACEHOLDER =
  "Los placeholders deben tener el formato exacto '{{nombre_campo}}'."

/** Aviso previo al guardado (réplica de `extraer_placeholders` y de la validación contra los
 * campos del evento). `null` si no hay nada que avisar; la validación real es la del backend. */
export function validarPlaceholders(
  asunto: string,
  cuerpo: string,
  campos: CampoEvento[],
): string | null {
  const usados = new Set<string>()
  for (const texto of [asunto, cuerpo]) {
    if (texto.includes('{{{') || texto.includes('}}}')) return ERROR_FORMATO_PLACEHOLDER
    for (const coincidencia of texto.matchAll(PLACEHOLDER)) usados.add(coincidencia[1])
    const restante = texto.replace(PLACEHOLDER, '')
    if (restante.includes('{{') || restante.includes('}}')) return ERROR_FORMATO_PLACEHOLDER
  }
  const conocidos = new Set(campos.map((campo) => campo.nombre_interno))
  const desconocidos = [...usados].filter((nombre) => !conocidos.has(nombre)).sort()
  if (desconocidos.length === 0) return null
  return `Estos campos no existen en el evento: ${desconocidos.join(', ')}.`
}

export type EstadoReglaFiltro = (typeof ESTADOS_REGLA_FILTRO)[number]

export function esEstadoReglaFiltro(valor: string): valor is EstadoReglaFiltro {
  return ESTADOS_REGLA_FILTRO.some((estado) => estado === valor)
}

export interface FiltrosReglas {
  busqueda: string
  estado: EstadoReglaFiltro
  /** `FILTRO_TODOS` o el id del tipo de evento. */
  tipoEventoId: string
}

export function filtrarReglas(reglas: ReglaWorkflow[], filtros: FiltrosReglas): ReglaWorkflow[] {
  const busqueda = filtros.busqueda.trim().toLocaleLowerCase(LOCALE)
  return reglas.filter((regla) => {
    if (busqueda !== '' && !regla.nombre.toLocaleLowerCase(LOCALE).includes(busqueda)) return false
    if (filtros.estado === FILTRO_ACTIVAS && !regla.activo) return false
    if (filtros.estado === FILTRO_INACTIVAS && regla.activo) return false
    return filtros.tipoEventoId === FILTRO_TODOS || regla.tipo_evento_id === filtros.tipoEventoId
  })
}

// Acciones que piden `concepto_cobro_id`: el catálogo de conceptos vive en Facturación y puede
// no estar disponible para el usuario (otro permiso).
export const ACCIONES_CON_CONCEPTO: readonly TipoAccion[] = [
  'generar_cargo',
  'actualizar_cuenta_corriente',
]

export const MOTIVO_SIN_CONCEPTOS =
  'No se pudieron cargar los conceptos de cobro. Hace falta el permiso Facturación · Leer.'

/** Marca como no disponibles las acciones que piden un concepto de cobro cuando el catálogo no
 * se pudo cargar. El resto del editor sigue funcionando. */
export function sinConceptosDisponibles(disponibles: AccionDisponible[]): AccionDisponible[] {
  return disponibles.map((accion) =>
    accion.disponible && ACCIONES_CON_CONCEPTO.includes(accion.tipo_accion)
      ? {
          ...accion,
          disponible: false,
          motivo: MOTIVO_SIN_CONCEPTOS,
        }
      : accion,
  )
}

/** Cambio de evento: la condición y la config que dependen del evento ya no valen, y si la
 * acción elegida no admite el nuevo evento también se limpia. */
export function cambiarEvento(
  valores: ValoresRegla,
  tipoEventoId: string,
  tiposAccion: TipoAccionCatalogo[],
  nombreEvento: string | null,
): ValoresRegla {
  const sigueDisponible = accionesDisponibles(tiposAccion, nombreEvento).some(
    (accion) => accion.tipo_accion === valores.tipoAccion && accion.disponible,
  )
  const config = { ...valores.config }
  for (const campo of CAMPOS_DEPENDIENTES_DEL_EVENTO) delete config[campo]
  return {
    ...valores,
    tipoEventoId,
    campoCondicion: '',
    operadorCondicion: '',
    valorCondicion: '',
    tipoAccion: sigueDisponible ? valores.tipoAccion : '',
    config: sigueDisponible ? config : {},
    // Si la acción sigue, la compatibilidad de la plantilla con el nuevo evento la resuelve el
    // editor cuando llega la lista de plantillas del evento.
    plantillaId: sigueDisponible ? valores.plantillaId : '',
  }
}

/** Cambio de acción hecho por el usuario: la config arranca con los defaults de la nueva acción
 * y recién ahí se aplica su default de aprobación humana. */
export function cambiarAccion(valores: ValoresRegla, accion: TipoAccionCatalogo): ValoresRegla {
  return {
    ...valores,
    tipoAccion: accion.tipo_accion,
    config: defaultsDeConfig(accion.config_schema),
    plantillaId: accion.admite_plantilla ? valores.plantillaId : '',
    requiereAprobacionHumana: accion.requiere_aprobacion_por_defecto,
  }
}

/** Cambio de campo en la condición: el operador pasa al primero válido para el tipo de dato y
 * el valor se vacía. `campo` vacío = sin condición. */
export function cambiarCampoCondicion(
  valores: ValoresRegla,
  campo: CampoEvento | null,
): ValoresRegla {
  return {
    ...valores,
    campoCondicion: campo?.nombre_interno ?? '',
    operadorCondicion: campo ? OPERADORES_POR_TIPO_DATO[campo.tipo_dato][0] : '',
    valorCondicion: '',
  }
}

export type EstadoEjecucionFiltro = (typeof ESTADOS_EJECUCION_FILTRO)[number]

export function esEstadoEjecucionFiltro(valor: string): valor is EstadoEjecucionFiltro {
  return ESTADOS_EJECUCION_FILTRO.some((estado) => estado === valor)
}

export const ETIQUETA_ESTADO_EJECUCION: Record<EstadoEjecucion, string> = {
  exitoso: 'Exitosa',
  fallido: 'Fallida',
  pendiente: 'Pendiente',
  rechazado: 'Rechazada',
}

export const VARIANTE_ESTADO_EJECUCION: Record<
  EstadoEjecucion,
  'exito' | 'error' | 'advertencia' | 'neutro'
> = { exitoso: 'exito', fallido: 'error', pendiente: 'advertencia', rechazado: 'neutro' }

const COMO_MONTO = (valor: string) => `$ ${valor}`

/** El catálogo de campos no trae unidades: se agregan acá. Lo que no esté se muestra tal cual. */
export const PRESENTACION_CAMPO: Record<string, (valor: string) => string> = {
  monto_deuda: COMO_MONTO,
  dias_vencido: (valor) => `${valor} ${valor === '1' ? 'día' : 'días'}`,
}

export function presentarCampo({ nombre_interno, valor }: CampoResumen): string {
  const presentar =
    PRESENTACION_CAMPO[nombre_interno] ?? (nombre_interno.startsWith('monto_') ? COMO_MONTO : null)
  return presentar ? presentar(valor) : valor
}

/** Primeros campos del evento en una sola línea, para la segunda línea de la tabla. */
export function resumenEnLinea(campos: CampoResumen[], maximo = 3): string {
  return campos.slice(0, maximo).map(presentarCampo).join(' · ')
}

export type EstadoEnvioFiltro = (typeof ESTADOS_ENVIO_FILTRO)[number]

export function esEstadoEnvioFiltro(valor: string): valor is EstadoEnvioFiltro {
  return ESTADOS_ENVIO_FILTRO.some((estado) => estado === valor)
}

export type DestinatarioTipoFiltro = (typeof DESTINATARIOS_TIPO_FILTRO)[number]

export function esDestinatarioTipoFiltro(valor: string): valor is DestinatarioTipoFiltro {
  return DESTINATARIOS_TIPO_FILTRO.some((tipo) => tipo === valor)
}

export const ETIQUETA_ESTADO_ENVIO: Record<EstadoEnvio, string> = {
  enviado: 'Enviada',
  fallido: 'Fallida',
  pendiente: 'Pendiente',
}

export const VARIANTE_ESTADO_ENVIO: Record<EstadoEnvio, 'exito' | 'error' | 'advertencia'> = {
  enviado: 'exito',
  fallido: 'error',
  pendiente: 'advertencia',
}

export const ETIQUETA_DESTINATARIO_TIPO: Record<DestinatarioTipo, string> = {
  familia: 'Familia',
  usuario: 'Usuario',
}

/** Duración legible, o `null` si la ejecución todavía no terminó. */
export function duracionEjecucion(startedAt: string, finishedAt: string | null): string | null {
  if (finishedAt === null) return null
  const segundos = Math.max(
    0,
    Math.round((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000),
  )
  if (segundos < 60) return `${segundos} s`
  const minutos = Math.floor(segundos / 60)
  if (minutos < 60) return `${minutos} min ${segundos % 60} s`
  return `${Math.floor(minutos / 60)} h ${minutos % 60} min`
}

/** Mismos ids sin importar el orden. */
export function mismosIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id))
}

// --- Tareas ---------------------------------------------------------------------------------

export type EstadoTareaFiltro = (typeof ESTADOS_TAREA_FILTRO)[number]

export function esEstadoTareaFiltro(valor: string): valor is EstadoTareaFiltro {
  return ESTADOS_TAREA_FILTRO.some((estado) => estado === valor)
}

export type PrioridadTareaFiltro = (typeof PRIORIDADES_TAREA_FILTRO)[number]

export function esPrioridadTareaFiltro(valor: string): valor is PrioridadTareaFiltro {
  return PRIORIDADES_TAREA_FILTRO.some((prioridad) => prioridad === valor)
}

export const ETIQUETA_ESTADO_TAREA: Record<EstadoTarea, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  completada: 'Completada',
  escalada: 'Escalada',
}

export const VARIANTE_ESTADO_TAREA: Record<
  EstadoTarea,
  'advertencia' | 'info' | 'exito' | 'neutro'
> = { pendiente: 'advertencia', en_progreso: 'info', completada: 'exito', escalada: 'neutro' }

export const ETIQUETA_PRIORIDAD_TAREA: Record<PrioridadTarea, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
}

export const VARIANTE_PRIORIDAD_TAREA: Record<PrioridadTarea, 'neutro' | 'info' | 'advertencia'> = {
  baja: 'neutro',
  media: 'info',
  alta: 'advertencia',
}

/** Réplica de `TRANSICIONES_TAREA` del backend: a qué estados puede pasar una persona la tarea.
 * `escalada` solo la pone el motor, y `completada` ya no se reabre. */
export function estadosSiguientesTarea(
  estado: EstadoTarea,
): readonly ('en_progreso' | 'completada')[] {
  if (estado === 'pendiente') return ['en_progreso', 'completada']
  if (estado === 'en_progreso') return ['completada']
  return []
}

export function opcionDeUsuario(usuario: UsuarioConRoles, grupo?: string): OpcionCombo {
  return {
    valor: usuario.id,
    etiqueta: nombreVisibleDeUsuario(usuario),
    detalle: usuario.email,
    grupo,
  }
}

/** Dentro de un diálogo o panel lateral, su bloqueo de scroll se traga la rueda sobre un popover
 * que va en un portal: la lista no se desplaza y lo que está más abajo queda fuera de alcance. Se
 * desplaza a mano, sin pasar por el bloqueo. */
export function desplazarConRueda(lista: HTMLDivElement | null) {
  if (lista === null) return
  lista.addEventListener(
    'wheel',
    (evento) => {
      evento.preventDefault()
      evento.stopPropagation()
      lista.scrollTop += evento.deltaY * (evento.deltaMode === 1 ? 16 : 1)
    },
    { passive: false },
  )
}
