// Funciones puras del editor de flujo: borrador del árbol, validación local (espejo de la del
// backend), auto-layout, frase en lenguaje natural, deshacer y duplicado.
import type { SeleccionDestinatarios } from '@/modules/workflows/components/destinatarios-campos'
import {
  MAX_COMPARACIONES,
  MAX_HISTORIAL,
  MAX_NODOS,
  MAX_PROFUNDIDAD,
} from '@/modules/workflows/constants'
import type {
  CampoEvento,
  EstadisticasNodo,
  EstadoNodoSimulado,
  Condicion,
  Criticidad,
  LogicaCondicion,
  NodoWorkflow,
  NodoWorkflowPayload,
  Operador,
  PosicionNodo,
  RamaNodo,
  ReglaWorkflow,
  ReglaWorkflowCreatePayload,
  TipoAccion,
  TipoAccionCatalogo,
  TipoEvento,
  TipoNodo,
} from '@/modules/workflows/types'
import {
  accionesDisponibles,
  admiteDestinatarios,
  armarCondicion,
  armarConfig,
  CAMPOS_DEPENDIENTES_DEL_EVENTO,
  CAMPOS_POR_ACCION,
  defaultsDeConfig,
  ETIQUETA_ACCION,
  ETIQUETA_OPERADOR,
  etiquetaEvento,
  OPERADORES_POR_TIPO_DATO,
} from '@/modules/workflows/utils'
import { CLAVE_CONFIG } from '@/modules/workflows/constants'

/** Id del nodo disparador en el lienzo: no existe en el backend, solo en el editor. */
export const DISPARADOR_ID = 'disparador'
export const SALIDA_DISPARADOR = 'salida'

export const ANCHO_COLUMNA = 340
export const ALTO_FILA = 128

export interface ComparacionEditor {
  campo: string
  operador: Operador | ''
  /** Texto, igual que el input; se convierte según el tipo del campo al guardar. */
  valor: string
}

export interface NodoEditor {
  id: string
  tipo: TipoNodo
  padreId: string | null
  rama: RamaNodo | null
  posicion: PosicionNodo
  /** Bloque que todavía no se unió al flujo (recién soltado desde la paleta o desconectado). */
  suelto: boolean
  logica: LogicaCondicion
  comparaciones: ComparacionEditor[]
  tipoAccion: TipoAccion | ''
  config: Record<string, string>
  /** Id de la plantilla elegida, o `''` si no hay. */
  plantillaId: string
  requiereAprobacionHumana: boolean
  seleccion: SeleccionDestinatarios
}

export interface BorradorFlujo {
  nombre: string
  tipoEventoId: string
  criticidad: Criticidad
  activo: boolean
  nodos: NodoEditor[]
}

export const BORRADOR_VACIO: BorradorFlujo = {
  nombre: '',
  tipoEventoId: '',
  criticidad: 'media',
  activo: true,
  nodos: [],
}

function nuevoId(): string {
  return crypto.randomUUID()
}

const COMPARACION_VACIA: ComparacionEditor = { campo: '', operador: '', valor: '' }

export function nuevoNodoCondicion(
  padreId: string | null,
  rama: RamaNodo | null,
  posicion: PosicionNodo = { x: 0, y: 0 },
): NodoEditor {
  return {
    id: nuevoId(),
    tipo: 'condicion',
    padreId,
    rama,
    posicion,
    suelto: false,
    logica: 'todas',
    comparaciones: [{ ...COMPARACION_VACIA }],
    tipoAccion: '',
    config: {},
    plantillaId: '',
    requiereAprobacionHumana: false,
    seleccion: { rolIds: [], usuarioIds: [] },
  }
}

export function nuevoNodoAccion(
  padreId: string | null,
  rama: RamaNodo | null,
  tipoAccion: TipoAccionCatalogo | null = null,
  posicion: PosicionNodo = { x: 0, y: 0 },
): NodoEditor {
  return {
    ...nuevoNodoCondicion(padreId, rama, posicion),
    tipo: 'accion',
    comparaciones: [],
    ...(tipoAccion ? valoresDeAccion(tipoAccion) : {}),
  }
}

/** Valores que toma un nodo al elegir una acción: los defaults de su config y de su aprobación. */
export function valoresDeAccion(
  accion: TipoAccionCatalogo,
): Pick<NodoEditor, 'tipoAccion' | 'config' | 'requiereAprobacionHumana'> {
  return {
    tipoAccion: accion.tipo_accion,
    config: defaultsDeConfig(accion.config_schema),
    requiereAprobacionHumana: accion.requiere_aprobacion_por_defecto,
  }
}

// --- Árbol ---------------------------------------------------------------------------------

/** Los nodos conectados a esa salida. Los sueltos no cuelgan del disparador aunque no tengan padre. */
export function hijosDe(
  nodos: readonly NodoEditor[],
  padreId: string | null,
  rama: RamaNodo | null = null,
): NodoEditor[] {
  return nodos.filter(
    (nodo) => nodo.padreId === padreId && nodo.rama === rama && !(padreId === null && nodo.suelto),
  )
}

function todosLosHijos(nodos: readonly NodoEditor[], padreId: string | null): NodoEditor[] {
  return nodos.filter((nodo) => nodo.padreId === padreId)
}

/** El nodo y todo lo que cuelga de él. */
export function subarbol(nodos: readonly NodoEditor[], raizId: string): NodoEditor[] {
  const raiz = nodos.find((nodo) => nodo.id === raizId)
  if (!raiz) return []
  const resultado: NodoEditor[] = []
  const pendientes = [raiz]
  while (pendientes.length > 0) {
    const actual = pendientes.shift()
    if (!actual) break
    resultado.push(actual)
    pendientes.push(...todosLosHijos(nodos, actual.id))
  }
  return resultado
}

export function eliminarSubarbol(nodos: readonly NodoEditor[], raizId: string): NodoEditor[] {
  const quitar = new Set(subarbol(nodos, raizId).map((nodo) => nodo.id))
  return nodos.filter((nodo) => !quitar.has(nodo.id))
}

export function profundidad(nodos: readonly NodoEditor[], id: string): number {
  let nivel = 0
  let actual = nodos.find((nodo) => nodo.id === id)
  while (actual) {
    nivel += 1
    const padreId: string | null = actual.padreId
    actual = padreId === null ? undefined : nodos.find((nodo) => nodo.id === padreId)
    if (nivel > nodos.length + 1) break
  }
  return nivel
}

export interface ConexionPropuesta {
  /** `null` = el disparador. */
  origenId: string | null
  destinoId: string
  rama: RamaNodo | null
}

/** Reglas de `isValidConnection`: un solo padre por nodo, solo las condiciones tienen salidas
 * Sí/No, y no se puede cerrar un ciclo ni pasar de la profundidad máxima. */
export function puedeConectar(
  nodos: readonly NodoEditor[],
  { origenId, destinoId, rama }: ConexionPropuesta,
): boolean {
  const destino = nodos.find((nodo) => nodo.id === destinoId)
  if (!destino?.suelto || origenId === destinoId) return false
  if (origenId === null) return rama === null
  const origen = nodos.find((nodo) => nodo.id === origenId)
  if (origen?.tipo !== 'condicion' || rama === null) return false
  if (subarbol(nodos, destinoId).some((nodo) => nodo.id === origenId)) return false
  const alturaDestino = Math.max(
    ...subarbol(nodos, destinoId).map((n) => alturaRelativa(nodos, n, destinoId)),
  )
  return profundidad(nodos, origenId) + alturaDestino <= MAX_PROFUNDIDAD
}

function alturaRelativa(nodos: readonly NodoEditor[], nodo: NodoEditor, raizId: string): number {
  let nivel = 1
  let actual: NodoEditor | undefined = nodo
  while (actual && actual.id !== raizId) {
    nivel += 1
    const padreId: string | null = actual.padreId
    actual = padreId === null ? undefined : nodos.find((item) => item.id === padreId)
  }
  return nivel
}

export function conectar(nodos: readonly NodoEditor[], conexion: ConexionPropuesta): NodoEditor[] {
  if (!puedeConectar(nodos, conexion)) return [...nodos]
  return nodos.map((nodo) =>
    nodo.id === conexion.destinoId
      ? { ...nodo, padreId: conexion.origenId, rama: conexion.rama, suelto: false }
      : nodo,
  )
}

/** Suelta el nodo (y su subárbol) de su padre: queda sin conectar hasta unirlo de nuevo. */
export function desconectar(nodos: readonly NodoEditor[], destinoId: string): NodoEditor[] {
  return nodos.map((nodo) =>
    nodo.id === destinoId ? { ...nodo, padreId: null, rama: null, suelto: true } : nodo,
  )
}

export function actualizarNodo(
  nodos: readonly NodoEditor[],
  id: string,
  cambios: Partial<NodoEditor>,
): NodoEditor[] {
  return nodos.map((nodo) => (nodo.id === id ? { ...nodo, ...cambios } : nodo))
}

// --- Auto-layout ---------------------------------------------------------------------------

/** Acomoda el árbol por niveles: cada hoja en su fila, cada nodo centrado respecto de sus hijos.
 * Las acciones hermanas quedan apiladas en una columna. */
export function ordenarArbol(nodos: readonly NodoEditor[]): NodoEditor[] {
  const posiciones = new Map<string, PosicionNodo>()
  let fila = 0

  function acomodar(nodo: NodoEditor, nivel: number): number {
    const hijos = [...hijosDe(nodos, nodo.id, 'si'), ...hijosDe(nodos, nodo.id, 'no')]
    let y: number
    if (hijos.length === 0) {
      y = fila * ALTO_FILA
      fila += 1
    } else {
      const ys = hijos.map((hijo) => acomodar(hijo, nivel + 1))
      y = (Math.min(...ys) + Math.max(...ys)) / 2
    }
    posiciones.set(nodo.id, { x: (nivel + 1) * ANCHO_COLUMNA, y })
    return y
  }

  for (const raiz of hijosDe(nodos, null)) acomodar(raiz, 0)
  // Nodos sueltos (sin padre accesible): debajo del árbol, en la primera columna.
  for (const suelto of nodos.filter((nodo) => !posiciones.has(nodo.id) && nodo.padreId === null)) {
    posiciones.set(suelto.id, { x: ANCHO_COLUMNA, y: fila * ALTO_FILA })
    fila += 1
  }
  return nodos.map((nodo) => ({ ...nodo, posicion: posiciones.get(nodo.id) ?? nodo.posicion }))
}

/** El disparador va a la izquierda de la primera columna, centrado respecto de sus nodos. */
export function posicionDisparador(nodos: readonly NodoEditor[]): PosicionNodo {
  const raices = hijosDe(nodos, null)
  if (raices.length === 0) return { x: 0, y: 0 }
  const ys = raices.map((nodo) => nodo.posicion.y)
  return {
    x: Math.min(...raices.map((nodo) => nodo.posicion.x)) - ANCHO_COLUMNA,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  }
}

/** Posición para un nodo nuevo cuelga de `padreId`: a la derecha del padre, debajo de sus hermanos. */
export function posicionParaHijo(
  nodos: readonly NodoEditor[],
  padreId: string | null,
  rama: RamaNodo | null,
): PosicionNodo {
  const padre = padreId === null ? null : nodos.find((nodo) => nodo.id === padreId)
  const base = padre ? padre.posicion : posicionDisparador(nodos)
  const hermanos = hijosDe(nodos, padreId, rama)
  const desplazamientoRama = rama === 'no' ? ALTO_FILA : rama === 'si' ? -ALTO_FILA / 2 : 0
  const ultimo = hermanos.at(-1)
  return {
    x: base.x + ANCHO_COLUMNA,
    y: ultimo ? ultimo.posicion.y + ALTO_FILA : base.y + desplazamientoRama,
  }
}

// --- Regla <-> borrador --------------------------------------------------------------------

function configDesdeNodo(
  tipoAccion: TipoAccion,
  guardada: Record<string, unknown> | null,
): Record<string, string> {
  const config: Record<string, string> = {}
  for (const { nombre } of CAMPOS_POR_ACCION[tipoAccion]) {
    const valor = guardada?.[nombre]
    if (typeof valor === 'string' || typeof valor === 'number') config[nombre] = String(valor)
  }
  return config
}

function nodoDesdeBackend(nodo: NodoWorkflow): NodoEditor {
  const base = nuevoNodoCondicion(nodo.padre_id, nodo.rama, nodo.posicion ?? { x: 0, y: 0 })
  const seleccion = {
    rolIds: nodo.destinatarios.roles.map((rol) => rol.id),
    usuarioIds: nodo.destinatarios.usuarios.map((usuario) => usuario.id),
  }
  if (nodo.tipo === 'condicion') {
    return {
      ...base,
      id: nodo.id,
      logica: nodo.condicion?.logica ?? 'todas',
      comparaciones: (nodo.condicion?.comparaciones ?? []).map((c) => ({
        campo: c.campo,
        operador: c.operador,
        valor: String(c.valor),
      })),
    }
  }
  return {
    ...base,
    id: nodo.id,
    tipo: 'accion',
    comparaciones: [],
    tipoAccion: nodo.tipo_accion ?? '',
    config: nodo.tipo_accion ? configDesdeNodo(nodo.tipo_accion, nodo.accion_config) : {},
    plantillaId: nodo.notificacion_template_id ?? '',
    requiereAprobacionHumana: nodo.requiere_aprobacion_humana,
    seleccion,
  }
}

/** Carga la regla guardada; si algún nodo no trae posición (reglas migradas), se auto-ordena. */
export function borradorDesdeRegla(regla: ReglaWorkflow): BorradorFlujo {
  const nodos = [...regla.nodos].sort((a, b) => a.orden - b.orden).map(nodoDesdeBackend)
  const sinPosicion = regla.nodos.some((nodo) => nodo.posicion === null)
  return {
    nombre: regla.nombre,
    tipoEventoId: regla.tipo_evento_id,
    criticidad: regla.criticidad,
    activo: regla.activo,
    nodos: sinPosicion ? ordenarArbol(nodos) : nodos,
  }
}

/** Copia para "Duplicar regla": todos los nodos con id nuevo, inactiva y sin guardar. */
export function duplicarRegla(regla: ReglaWorkflow): BorradorFlujo {
  const original = borradorDesdeRegla(regla)
  const ids = new Map(original.nodos.map((nodo) => [nodo.id, nuevoId()]))
  return {
    ...original,
    nombre: `Copia de ${regla.nombre}`,
    activo: false,
    nodos: original.nodos.map((nodo) => ({
      ...nodo,
      id: ids.get(nodo.id) ?? nuevoId(),
      padreId: nodo.padreId === null ? null : (ids.get(nodo.padreId) ?? null),
    })),
  }
}

/** Copia el nodo con todo su subárbol (ids nuevos) como hermano del original. Devuelve la lista
 * completa y el id de la copia. */
export function duplicarSubarbol(
  nodos: readonly NodoEditor[],
  raizId: string,
): { nodos: NodoEditor[]; copiaId: string | null } {
  const original = subarbol(nodos, raizId)
  if (original.length === 0 || nodos.length + original.length > MAX_NODOS) {
    return { nodos: [...nodos], copiaId: null }
  }
  const ids = new Map(original.map((nodo) => [nodo.id, nuevoId()]))
  const copias = original.map((nodo) => ({
    ...nodo,
    id: ids.get(nodo.id) ?? nuevoId(),
    padreId: nodo.id === raizId ? nodo.padreId : (ids.get(nodo.padreId ?? '') ?? nodo.padreId),
    posicion: { x: nodo.posicion.x + 40, y: nodo.posicion.y + 56 },
  }))
  return { nodos: [...nodos, ...copias], copiaId: ids.get(raizId) ?? null }
}

function condicionDeNodo(nodo: NodoEditor, campos: CampoEvento[]): Condicion[] {
  const condiciones: Condicion[] = []
  for (const comparacion of nodo.comparaciones) {
    const tipoDato = campos.find((c) => c.nombre_interno === comparacion.campo)?.tipo_dato ?? null
    const armada = armarCondicion(
      comparacion.campo,
      comparacion.operador,
      comparacion.valor,
      tipoDato,
    )
    if (armada.campo !== undefined && armada.operador !== undefined && armada.valor !== undefined) {
      condiciones.push({ campo: armada.campo, operador: armada.operador, valor: armada.valor })
    }
  }
  return condiciones
}

function payloadDeNodo(
  nodo: NodoEditor,
  tiposAccion: TipoAccionCatalogo[],
  campos: CampoEvento[],
): NodoWorkflowPayload {
  const base = {
    id: nodo.id,
    tipo: nodo.tipo,
    padre_id: nodo.padreId,
    rama: nodo.rama,
    posicion: nodo.posicion,
  }
  if (nodo.tipo === 'condicion') {
    return {
      ...base,
      condicion: { logica: nodo.logica, comparaciones: condicionDeNodo(nodo, campos) },
      tipo_accion: null,
      accion_config: null,
      notificacion_template_id: null,
      requiere_aprobacion_humana: null,
      destinatarios: { rol_ids: [], usuario_ids: [] },
    }
  }
  const tipoAccion = nodo.tipoAccion === '' ? null : nodo.tipoAccion
  const catalogo = tiposAccion.find((tipo) => tipo.tipo_accion === tipoAccion)
  const conDestinatarios = admiteDestinatarios(nodo.tipoAccion, nodo.config)
  return {
    ...base,
    condicion: null,
    tipo_accion: tipoAccion,
    accion_config: tipoAccion ? armarConfig(tipoAccion, nodo.config) : null,
    notificacion_template_id:
      catalogo?.admite_plantilla && nodo.plantillaId !== '' ? nodo.plantillaId : null,
    // Siempre se manda: sin esto el backend recalcularía el default al cambiar de acción.
    requiere_aprobacion_humana: nodo.requiereAprobacionHumana,
    destinatarios: {
      rol_ids: conDestinatarios ? nodo.seleccion.rolIds : [],
      usuario_ids: conDestinatarios ? nodo.seleccion.usuarioIds : [],
    },
  }
}

export function payloadDesdeBorrador(
  borrador: BorradorFlujo,
  tiposAccion: TipoAccionCatalogo[],
  evento: TipoEvento | undefined,
): ReglaWorkflowCreatePayload {
  const campos = evento?.campos ?? []
  return {
    nombre: borrador.nombre.trim(),
    tipo_evento_id: borrador.tipoEventoId,
    criticidad: borrador.criticidad,
    activo: borrador.activo,
    nodos: borrador.nodos.map((nodo) => payloadDeNodo(nodo, tiposAccion, campos)),
  }
}

// --- Cambios que arrastra elegir evento ----------------------------------------------------

/** Cambio de disparador: las comparaciones dependen de los campos del evento y las acciones de
 * sus `eventos_permitidos`, así que se limpia lo que ya no corresponde. */
export function cambiarEventoDelBorrador(
  borrador: BorradorFlujo,
  tipoEventoId: string,
  tiposAccion: TipoAccionCatalogo[],
  nombreEvento: string | null,
): BorradorFlujo {
  if (borrador.tipoEventoId === tipoEventoId) return borrador
  const permitidas = accionesDisponibles(tiposAccion, nombreEvento)
  return {
    ...borrador,
    tipoEventoId,
    nodos: borrador.nodos.map((nodo) => {
      if (nodo.tipo === 'condicion') {
        return { ...nodo, comparaciones: [{ ...COMPARACION_VACIA }] }
      }
      const sigue = permitidas.some((a) => a.tipo_accion === nodo.tipoAccion && a.disponible)
      if (!sigue) return { ...nodo, tipoAccion: '', config: {}, plantillaId: '' }
      const config = { ...nodo.config }
      for (const campo of CAMPOS_DEPENDIENTES_DEL_EVENTO) delete config[campo]
      return { ...nodo, config }
    }),
  }
}

export function cambiarCampoDeComparacion(campo: CampoEvento | null): ComparacionEditor {
  return {
    campo: campo?.nombre_interno ?? '',
    operador: campo ? OPERADORES_POR_TIPO_DATO[campo.tipo_dato][0] : '',
    valor: '',
  }
}

// --- Validación local ----------------------------------------------------------------------

export interface ErroresFlujo {
  general: string[]
  /** Primer problema de cada nodo incompleto, por id. */
  porNodo: Record<string, string>
}

const CONFIG_OBLIGATORIA: Partial<Record<TipoAccion, readonly [string, string][]>> = {
  crear_tarea: [[CLAVE_CONFIG.titulo, 'Falta el título de la tarea']],
  generar_cargo: [[CLAVE_CONFIG.conceptoCobroId, 'Falta el concepto de cobro']],
  cambiar_estado: [[CLAVE_CONFIG.estadoNuevo, 'Falta el estado nuevo']],
  actualizar_cuenta_corriente: [
    [CLAVE_CONFIG.conceptoCobroId, 'Falta el concepto de cobro'],
    [CLAVE_CONFIG.campoMonto, 'Falta el campo del monto'],
  ],
}

function errorDeCondicion(nodo: NodoEditor): string | null {
  if (nodo.comparaciones.length === 0) return 'Falta al menos una comparación'
  if (nodo.comparaciones.length > MAX_COMPARACIONES) {
    return `Hasta ${MAX_COMPARACIONES} comparaciones por condición`
  }
  const incompleta = nodo.comparaciones.some(
    (c) => c.campo === '' || c.operador === '' || c.valor.trim() === '',
  )
  return incompleta ? 'Completá el campo, el operador y el valor' : null
}

function errorDeAccion(nodo: NodoEditor, tiposAccion: TipoAccionCatalogo[]): string | null {
  if (nodo.tipoAccion === '') return 'Elegí qué hace esta acción'
  const catalogo = tiposAccion.find((tipo) => tipo.tipo_accion === nodo.tipoAccion)
  if (catalogo && !catalogo.implementada) return 'Esta acción todavía no está disponible'
  if (nodo.tipoAccion === 'notificar' && nodo.plantillaId === '') return 'Falta la plantilla'
  for (const [clave, mensaje] of CONFIG_OBLIGATORIA[nodo.tipoAccion] ?? []) {
    if ((nodo.config[clave] ?? '').trim() === '') return mensaje
  }
  return null
}

/** Qué le falta al borrador para poder guardarse. La validación real es la del backend: esto
 * evita el viaje y marca el nodo incompleto. */
export function validarBorrador(
  borrador: BorradorFlujo,
  tiposAccion: TipoAccionCatalogo[],
): ErroresFlujo {
  const general: string[] = []
  const porNodo: Record<string, string> = {}
  if (borrador.nombre.trim() === '') general.push('Falta el nombre de la regla.')
  if (borrador.tipoEventoId === '') general.push('Elegí qué evento dispara la regla.')
  if (borrador.nodos.length > MAX_NODOS) general.push(`Hasta ${MAX_NODOS} bloques por regla.`)
  if (!borrador.nodos.some((nodo) => nodo.tipo === 'accion' && !nodo.suelto)) {
    general.push('La regla necesita al menos una acción.')
  }
  for (const nodo of borrador.nodos) {
    const error = nodo.suelto
      ? 'Conectalo al flujo o eliminalo'
      : nodo.tipo === 'condicion'
        ? errorDeCondicion(nodo)
        : errorDeAccion(nodo, tiposAccion)
    if (error) porNodo[nodo.id] = error
    if (profundidad(borrador.nodos, nodo.id) > MAX_PROFUNDIDAD) {
      general.push(`El flujo admite hasta ${MAX_PROFUNDIDAD} niveles.`)
      break
    }
  }
  return { general, porNodo }
}

export function hayErrores(errores: ErroresFlujo): boolean {
  return errores.general.length > 0 || Object.keys(errores.porNodo).length > 0
}

// --- Texto ---------------------------------------------------------------------------------

export function textoComparacion(comparacion: ComparacionEditor, campos: CampoEvento[]): string {
  const campo = campos.find((c) => c.nombre_interno === comparacion.campo)
  if (!campo) return 'sin definir'
  const operador = comparacion.operador === '' ? '' : ETIQUETA_OPERADOR[comparacion.operador]
  return `${campo.etiqueta} ${operador} ${comparacion.valor || '…'}`.replace(/\s+/g, ' ').trim()
}

export function textoCondicion(
  nodo: NodoEditor,
  campos: CampoEvento[],
  enMinusculas = false,
): string {
  const partes = nodo.comparaciones.map((c) => {
    const texto = textoComparacion(c, campos)
    return enMinusculas ? enMinuscula(texto) : texto
  })
  if (partes.length === 0) return 'sin definir'
  return partes.join(nodo.logica === 'todas' ? ' y ' : ' o ')
}

function enMinuscula(texto: string): string {
  return texto.charAt(0).toLowerCase() + texto.slice(1)
}

function listar(partes: string[]): string {
  if (partes.length <= 1) return partes.join('')
  return `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}`
}

/** Resumen de la regla en una frase: "Cuando …, si … entonces …; si no …". */
export function fraseRegla(borrador: BorradorFlujo, tiposEvento: TipoEvento[]): string {
  const evento = tiposEvento.find((tipo) => tipo.id === borrador.tipoEventoId)
  if (!evento) return 'Elegí el evento que dispara la regla.'
  const campos = evento.campos

  function describir(padreId: string | null, rama: RamaNodo | null): string {
    const hijos = hijosDe(borrador.nodos, padreId, rama)
    const acciones = hijos
      .filter((nodo) => nodo.tipo === 'accion')
      .map((nodo) => {
        const base = nodo.tipoAccion ? enMinuscula(ETIQUETA_ACCION[nodo.tipoAccion]) : 'una acción'
        return nodo.requiereAprobacionHumana ? `${base} (con aprobación)` : base
      })
    const condiciones = hijos
      .filter((nodo) => nodo.tipo === 'condicion')
      .map((nodo) => {
        const si = describir(nodo.id, 'si')
        const no = describir(nodo.id, 'no')
        const cabecera = `si ${textoCondicion(nodo, campos, true)}`
        return [si ? `${cabecera}, ${si}` : cabecera, no ? `si no, ${no}` : '']
          .filter(Boolean)
          .join('; ')
      })
    return [acciones.length > 0 ? listar(acciones) : '', ...condiciones].filter(Boolean).join('; ')
  }

  const cuerpo = describir(null, null)
  const cabecera = `Cuando ${enMinuscula(etiquetaEvento(evento.nombre))}`
  return cuerpo ? `${cabecera}: ${cuerpo}.` : `${cabecera}, todavía sin acciones.`
}

// --- Historial (deshacer / rehacer) --------------------------------------------------------

export interface Historial<T> {
  pasado: T[]
  presente: T
  futuro: T[]
}

export function iniciarHistorial<T>(presente: T): Historial<T> {
  return { pasado: [], presente, futuro: [] }
}

export function registrarCambio<T>(historial: Historial<T>, nuevo: T): Historial<T> {
  if (Object.is(historial.presente, nuevo)) return historial
  return {
    pasado: [...historial.pasado, historial.presente].slice(-MAX_HISTORIAL),
    presente: nuevo,
    futuro: [],
  }
}

export function deshacer<T>(historial: Historial<T>): Historial<T> {
  const anterior = historial.pasado.at(-1)
  if (anterior === undefined) return historial
  return {
    pasado: historial.pasado.slice(0, -1),
    presente: anterior,
    futuro: [historial.presente, ...historial.futuro],
  }
}

export function rehacer<T>(historial: Historial<T>): Historial<T> {
  const siguiente = historial.futuro[0]
  if (siguiente === undefined) return historial
  return {
    pasado: [...historial.pasado, historial.presente],
    presente: siguiente,
    futuro: historial.futuro.slice(1),
  }
}

/** Dominios en los que la paleta agrupa las 15 acciones. */
export const GRUPOS_ACCION: readonly { titulo: string; acciones: readonly TipoAccion[] }[] = [
  {
    titulo: 'Comunicación',
    acciones: ['notificar', 'alerta_interna', 'generar_recordatorio', 'generar_comunicacion'],
  },
  { titulo: 'Tareas', acciones: ['crear_tarea', 'escalar_caso'] },
  {
    titulo: 'Facturación',
    acciones: [
      'generar_cargo',
      'aplicar_vencimiento',
      'aplicar_penalidad',
      'cambiar_estado',
      'registrar_pago',
      'registrar_rechazo',
      'actualizar_cuenta_corriente',
    ],
  },
  {
    titulo: 'Compras y registros',
    acciones: ['generar_orden_compra', 'crear_registro_relacionado'],
  },
]

export type EstadoBloque = 'disponible' | 'no_permitida' | 'no_disponible'

export const MOTIVO_NO_PERMITIDA = 'No permitida para este evento'
export const MOTIVO_NO_DISPONIBLE = 'Todavía no disponible'

/** En qué estado está cada acción de la paleta: disponible, no permitida para el evento o todavía
 * sin ejecutor. */
export function estadoDeBloque(
  tipoAccion: TipoAccion,
  tiposAccion: TipoAccionCatalogo[],
  nombreEvento: string | null,
): { estado: EstadoBloque; motivo: string | null } {
  const catalogo = tiposAccion.find((tipo) => tipo.tipo_accion === tipoAccion)
  if (catalogo && !catalogo.implementada) {
    return { estado: 'no_disponible', motivo: MOTIVO_NO_DISPONIBLE }
  }
  const permitida = accionesDisponibles(tiposAccion, nombreEvento).find(
    (accion) => accion.tipo_accion === tipoAccion,
  )
  if (permitida && !permitida.disponible) {
    return { estado: 'no_permitida', motivo: permitida.motivo ?? MOTIVO_NO_PERMITIDA }
  }
  return { estado: 'disponible', motivo: null }
}

/** Cierra un cambio hecho en varios pasos (como arrastrar un nodo): el historial recuerda `base`,
 * el estado de antes del gesto, como un único paso. */
export function confirmarCambio<T>(historial: Historial<T>, base: T): Historial<T> {
  if (Object.is(historial.presente, base)) return historial
  return {
    pasado: [...historial.pasado, base].slice(-MAX_HISTORIAL),
    presente: historial.presente,
    futuro: [],
  }
}

/** Reemplaza el presente sin dejar rastro en el historial (los pasos intermedios de un arrastre). */
export function reemplazarPresente<T>(historial: Historial<T>, nuevo: T): Historial<T> {
  return { ...historial, presente: nuevo }
}

/** "N exitosas · N fallidas · N pendientes" de los últimos días, con enlace a Ejecuciones
 * filtrado por regla y nodo. Se omite lo que está en cero. */
export function textoContadores(estadisticas: EstadisticasNodo): string {
  const partes = [
    [estadisticas.exitoso, 'exitosas', 'exitosa'],
    [estadisticas.fallido, 'fallidas', 'fallida'],
    [estadisticas.pendiente, 'pendientes', 'pendiente'],
  ]
    .filter(([cantidad]) => Number(cantidad) > 0)
    .map(([cantidad, plural, singular]) => `${cantidad} ${cantidad === 1 ? singular : plural}`)
  return partes.length > 0 ? partes.join(' · ') : 'Sin ejecuciones'
}

export const TEXTO_SIMULACION: Record<EstadoNodoSimulado, string> = {
  cumple: 'Se cumple',
  no_cumple: 'No se cumple',
  error: 'No se pudo evaluar',
  alcanzada: 'Alcanzada',
  requiere_aprobacion: 'Espera aprobación',
  diferida: 'Diferida',
  no_implementada: 'No implementada',
  config_invalida: 'Configuración inválida',
  no_alcanzado: 'No alcanzado',
}
