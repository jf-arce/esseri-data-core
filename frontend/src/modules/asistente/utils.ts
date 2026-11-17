import { matchPath } from 'react-router'
import { tienePermiso } from '@/modules/auth/constants'
import { destinosDe, filtrarNav, NAV_GROUPS } from '@/layout/nav-items'
import type { Permiso } from '@/modules/auth/types'
import {
  RUTA_EJECUCIONES,
  RUTA_NOTIFICACIONES,
  RUTA_REGLAS,
  RUTA_TAREAS,
} from '@/modules/workflows/constants'
import { COMANDOS, SUGERENCIAS, type ComandoDeEntrada } from './constants'
import type {
  AliasResuelto,
  Bloque,
  BloqueGrafico,
  BloqueKpi,
  BloqueTabla,
  ColumnaTabla,
  ComandoBackend,
  ContextoPantalla,
  EventoSse,
  MensajeVisible,
  TipoAlias,
  ValorCelda,
} from './types'

// Claves de destino que el backend le ofrece al modelo (`DESTINOS` en
// `backend/src/asistente/herramientas_navegacion.py`) y la ruta de cada una. El modelo elige una
// clave: nunca se navega a una URL que haya generado él.
export const RUTAS_DE_DESTINO: Record<string, string> = {
  panel_direccion: '/panel',
  panel_administrativo: '/admin',
  comunicaciones: '/comunicaciones',
  familias: '/familias-alumnos',
  alumnos: '/familias-alumnos/alumnos',
  academico: '/academico',
  materias: '/academico/materias',
  asignaciones_docentes: '/academico/asignaciones',
  historial_asistencia: '/academico/historial-asistencia',
  inscripciones: '/inscripciones',
  admisiones: '/inscripciones/admisiones',
  facturas: '/facturacion',
  deuda_por_familia: '/facturacion/deudas/familias',
  reglas_facturacion: '/facturacion/reglas',
  penalidades: '/facturacion/penalidades',
  proveedores: '/proveedores',
  solicitudes_compra: '/solicitudes-compra',
  ordenes_compra: '/ordenes-compra',
  catalogo_compras: '/catalogo-compras',
  reglas_workflows: RUTA_REGLAS,
  ejecuciones: RUTA_EJECUCIONES,
  notificaciones: RUTA_NOTIFICACIONES,
  tareas: RUTA_TAREAS,
  usuarios: '/usuarios-roles/usuarios',
  roles: '/usuarios-roles/roles',
}

/** Ruta de una clave de destino, solo si el menú del rol activo la muestra. */
// Filtros que cada pantalla entiende en su URL. El resto se descarta.
const FILTROS_DE_DESTINO: Record<string, string[]> = {
  academico: ['nivel', 'anio', 'division'],
}
const PATRON_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function rutaDeDestino(
  clave: string,
  rolActivo: string | null,
  permisos: Permiso[],
  filtros?: Record<string, string>,
): string | null {
  const ruta = RUTAS_DE_DESTINO[clave]
  if (ruta === undefined) return null
  const permitidas = destinosDe(filtrarNav(NAV_GROUPS, rolActivo, permisos))
  if (!permitidas.some((destino) => destino.ruta === ruta)) return null

  const consulta = new URLSearchParams()
  for (const nombre of FILTROS_DE_DESTINO[clave] ?? []) {
    const valor = filtros?.[nombre]
    if (valor !== undefined && PATRON_ID.test(valor)) consulta.set(nombre, valor)
  }
  const texto = consulta.toString()
  return texto === '' ? ruta : `${ruta}?${texto}`
}

// Mismas rutas que `busqueda-global.ts` para alumnos y familias. Los docentes no tienen ficha.
export function rutaDeEntidad(tipo: TipoAlias, id: string): string | null {
  if (tipo === 'DOCENTE') return null
  const segmento = tipo === 'ALUMNO' ? 'alumnos' : 'familias'
  return `/familias-alumnos/${segmento}/${encodeURIComponent(id)}`
}

/** Nombre de la pantalla de una clave de destino, tal como figura en el menú del rol activo. */
export function etiquetaDeDestino(
  clave: string,
  rolActivo: string | null,
  permisos: Permiso[],
): string | null {
  const ruta = RUTAS_DE_DESTINO[clave]
  if (ruta === undefined) return null
  const destino = destinosDe(filtrarNav(NAV_GROUPS, rolActivo, permisos)).find(
    (candidato) => candidato.ruta === ruta,
  )
  return destino?.etiqueta ?? null
}

/**
 * Nombre de la pantalla en que está la persona, tal como figura en el menú de su rol: la entrada
 * más específica que coincide con la ruta (así `/academico/historial-asistencia` gana sobre
 * `/academico`). `null` si la ruta no está en su menú.
 */
export function etiquetaDePantalla(
  pathname: string,
  rolActivo: string | null,
  permisos: Permiso[],
): string | null {
  const coincidencias = destinosDe(filtrarNav(NAV_GROUPS, rolActivo, permisos)).filter(
    (destino) => pathname === destino.ruta || pathname.startsWith(`${destino.ruta}/`),
  )
  const mejor = coincidencias.reduce<(typeof coincidencias)[number] | null>(
    (actual, candidato) =>
      actual === null || candidato.ruta.length > actual.ruta.length ? candidato : actual,
    null,
  )
  return mejor?.etiqueta ?? null
}

// --- Campo de texto: `@` y `/` -----------------------------------------------------------------

/** "@mar" justo antes del cursor: lo que sigue a la última arroba sin espacios. */
export function consultaDeMencion(texto: string, cursor: number): string | null {
  const coincidencia = texto.slice(0, cursor).match(/(?:^|\s)@([^\s@]*)$/)
  return coincidencia ? coincidencia[1] : null
}

/** "/deu" si el mensaje empieza con `/` y el cursor sigue en esa primera palabra. */
export function consultaDeComando(texto: string, cursor: number): string | null {
  const coincidencia = texto.slice(0, cursor).match(/^\/([^\s/]*)$/)
  return coincidencia ? coincidencia[1] : null
}

function sinTildes(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/** Atajos que el rol puede usar y que empiezan con lo escrito después de `/`. */
export function comandosDisponibles(permisos: Permiso[], consulta: string): ComandoDeEntrada[] {
  const buscado = sinTildes(consulta)
  return COMANDOS.filter(
    (c) =>
      c.permisos.every((permiso) => tienePermiso(permisos, permiso)) &&
      sinTildes(c.nombre).startsWith(buscado),
  )
}

/**
 * Qué se manda al enviar. El atajo elegido define el comando; sin texto después, va la pregunta
 * por defecto del atajo (los que exigen texto no se pueden enviar vacíos: devuelven `''`).
 */
export function resolverEnvio(
  contenido: string,
  elegido: ComandoDeEntrada | null,
): { contenido: string; comando: ComandoBackend | null } {
  const texto = contenido.trim()
  if (elegido === null || elegido.comando === null) return { contenido: texto, comando: null }
  return {
    contenido: texto === '' ? elegido.preguntaPorDefecto : texto,
    comando: elegido.comando,
  }
}

/** Atajo escrito a mano al inicio del campo (`/grafico deuda`): el atajo y el resto del texto. */
export function atajoAlInicio(
  texto: string,
  permisos: Permiso[],
): { comando: ComandoDeEntrada; resto: string } | null {
  const coincidencia = texto.match(/^\/([^\s/]+) ([\s\S]*)$/)
  if (coincidencia === null) return null
  const comando = comandosDisponibles(permisos, coincidencia[1]).find(
    (c) => c.nombre === coincidencia[1] && c.comando !== null,
  )
  return comando === undefined ? null : { comando, resto: coincidencia[2] }
}

/** Separa el `/atajo` con el que se guardó un mensaje del usuario de lo que escribió después. */
export function separarComando(contenido: string): {
  comando: ComandoDeEntrada | null
  texto: string
} {
  const coincidencia = contenido.match(/^\/([a-z]+)(?: ([\s\S]*))?$/)
  const comando =
    coincidencia === null
      ? undefined
      : COMANDOS.find((c) => c.comando !== null && c.nombre === coincidencia[1])
  if (coincidencia === null || comando === undefined) return { comando: null, texto: contenido }
  return { comando, texto: coincidencia[2] ?? '' }
}

/** Palabras sin tildes ni mayúsculas, con los números y las letras separados ("3°A" → 3, a). */
function palabrasDeBusqueda(texto: string): string[] {
  return sinTildes(texto).match(/\d+|[a-z\u00f1]+/g) ?? []
}

/**
 * Coincidencia para filtrar docentes y cursos en el navegador: cada palabra escrita tiene que ser
 * el comienzo de alguna palabra del nombre, en cualquier orden y sin tildes ni mayúsculas. Así
 * "3", "a", "3a", "3° a", "prim" o "3 a primario" encuentran a "3°A de Primario", y "ana perez"
 * a "Ana Pérez".
 */
export function coincideConBusqueda(nombre: string, consulta: string): boolean {
  const palabrasNombre = palabrasDeBusqueda(nombre)
  return palabrasDeBusqueda(consulta).every((buscada) =>
    palabrasNombre.some((palabra) => palabra.startsWith(buscada)),
  )
}

// --- Contexto de pantalla ----------------------------------------------------------------------

/** Ficha abierta según la URL (`alumnos/:alumnoId`, `familias/:familiaId`), o `null`. */
export function contextoDeRuta(pathname: string): ContextoPantalla | null {
  const alumno = matchPath('/familias-alumnos/alumnos/:alumnoId', pathname)?.params.alumnoId
  if (alumno !== undefined && PATRON_ID.test(alumno)) return { tipo: 'ALUMNO', entidad_id: alumno }
  const familia = matchPath('/familias-alumnos/familias/:familiaId', pathname)?.params.familiaId
  if (familia !== undefined && PATRON_ID.test(familia)) {
    return { tipo: 'FAMILIA', entidad_id: familia }
  }
  return null
}

// --- Alias -----------------------------------------------------------------------------------

const PATRON_ALIAS = /\[(ALUMNO|FAMILIA|DOCENTE):(\d+)\]/g

export type TrozoDeTexto = { tipo: 'texto'; valor: string } | { tipo: 'alias'; alias: string }

/** Parte un texto en tramos de texto plano y alias, para rehidratar los alias por separado. */
export function partirTextoConAlias(texto: string): TrozoDeTexto[] {
  const trozos: TrozoDeTexto[] = []
  let cursor = 0
  for (const coincidencia of texto.matchAll(PATRON_ALIAS)) {
    const inicio = coincidencia.index
    if (inicio > cursor) trozos.push({ tipo: 'texto', valor: texto.slice(cursor, inicio) })
    trozos.push({ tipo: 'alias', alias: coincidencia[0] })
    cursor = inicio + coincidencia[0].length
  }
  if (cursor < texto.length) trozos.push({ tipo: 'texto', valor: texto.slice(cursor) })
  return trozos
}

export function aliasEnTexto(texto: string): string[] {
  return Array.from(new Set(Array.from(texto.matchAll(PATRON_ALIAS), (c) => c[0])))
}

export function tipoDeAlias(alias: string): TipoAlias | null {
  if (alias.startsWith('[ALUMNO:')) return 'ALUMNO'
  if (alias.startsWith('[FAMILIA:')) return 'FAMILIA'
  if (alias.startsWith('[DOCENTE:')) return 'DOCENTE'
  return null
}

/** Etiqueta neutra mientras el alias no se resolvió, o si el rol no puede ver personas. */
export function etiquetaGenerica(alias: string): string {
  const tipo = tipoDeAlias(alias)
  const numero = alias.match(/:(\d+)\]/)?.[1] ?? ''
  const base = tipo === 'FAMILIA' ? 'Familia' : tipo === 'DOCENTE' ? 'Docente' : 'Alumno'
  return `${base} ${numero}`.trim()
}

// --- SSE -------------------------------------------------------------------------------------

const EVENTOS_CONOCIDOS = new Set(['herramienta', 'texto', 'tarjeta', 'navegar', 'fin', 'error'])

/**
 * Parser incremental de Server-Sent Events. Recibe el texto acumulado (`pendiente`) más el
 * fragmento nuevo y devuelve los eventos completos y el resto sin terminar. Ignora eventos que
 * no conoce y datos que no son JSON.
 */
export function parsearSse(
  pendiente: string,
  fragmento: string,
): { eventos: EventoSse[]; resto: string } {
  const texto = (pendiente + fragmento).replace(/\r\n/g, '\n')
  const bloques = texto.split('\n\n')
  const resto = bloques.pop() ?? ''
  const eventos: EventoSse[] = []
  for (const bloque of bloques) {
    let nombre = 'message'
    const datos: string[] = []
    for (const linea of bloque.split('\n')) {
      if (linea.startsWith('event:')) nombre = linea.slice(6).trim()
      else if (linea.startsWith('data:')) datos.push(linea.slice(5).trimStart())
    }
    if (!EVENTOS_CONOCIDOS.has(nombre) || datos.length === 0) continue
    try {
      const parseado: unknown = JSON.parse(datos.join('\n'))
      if (typeof parseado === 'object' && parseado !== null) {
        eventos.push({ evento: nombre, datos: parseado } as EventoSse)
      }
    } catch {
      continue
    }
  }
  return { eventos, resto }
}

// --- Celdas ----------------------------------------------------------------------------------

export function formatearCelda(
  valor: string | number | null,
  tipo: 'texto' | 'numero' | 'moneda' | 'porcentaje' | 'alias',
): string {
  if (valor === null) return tipo === 'porcentaje' ? 'Sin registros' : '—'
  if (typeof valor === 'string') return valor
  if (tipo === 'moneda') {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(valor)
  }
  if (tipo === 'porcentaje') return `${valor.toLocaleString('es-AR')} %`
  return valor.toLocaleString('es-AR')
}

// --- Orden de tablas ---------------------------------------------------------------------------

export type OrdenTabla = { clave: string; dir: 'asc' | 'desc' }

/** Ciclo del encabezado: sin orden, ascendente, descendente y de vuelta a sin orden. */
export function siguienteOrden(actual: OrdenTabla | null, clave: string): OrdenTabla | null {
  if (actual?.clave !== clave) return { clave, dir: 'asc' }
  return actual.dir === 'asc' ? { clave, dir: 'desc' } : null
}

/** Filas ordenadas por una columna: los números como números, el texto y los alias (por nombre
 * si ya se resolvió) con `localeCompare`. Los vacíos van siempre al final. No muta `filas`. */
export function ordenarFilas(
  filas: Record<string, ValorCelda>[],
  columna: ColumnaTabla,
  dir: 'asc' | 'desc',
  porAlias: Record<string, AliasResuelto>,
): Record<string, ValorCelda>[] {
  const numerica =
    columna.tipo === 'numero' || columna.tipo === 'moneda' || columna.tipo === 'porcentaje'
  const signo = dir === 'asc' ? 1 : -1
  const clave = (fila: Record<string, ValorCelda>): ValorCelda => {
    const valor = fila[columna.clave] ?? null
    if (columna.tipo === 'alias' && typeof valor === 'string')
      return porAlias[valor]?.nombre ?? valor
    return valor
  }
  return [...filas].sort((a, b) => {
    const va = clave(a)
    const vb = clave(b)
    if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1
    if (numerica && typeof va === 'number' && typeof vb === 'number') return (va - vb) * signo
    return String(va).localeCompare(String(vb), 'es-AR', { numeric: true }) * signo
  })
}

// --- Gráficos ----------------------------------------------------------------------------------

export type PuntoGrafico = Record<string, string | number | null>

/**
 * Filas del gráfico, tomadas de su tabla: el eje X como texto y las series como números. Si el
 * eje es una columna de alias, muestra el nombre resuelto en vez del `[FAMILIA:1]`.
 */
export function datosDeGrafico(
  bloque: BloqueGrafico,
  tabla: BloqueTabla,
  porAlias: Record<string, AliasResuelto> = {},
): PuntoGrafico[] {
  const ejeEsAlias = tabla.columnas.some((c) => c.clave === bloque.eje_x && c.tipo === 'alias')
  return tabla.filas.map((fila) => {
    const crudo = String(fila[bloque.eje_x] ?? '')
    const etiqueta = ejeEsAlias ? (porAlias[crudo]?.nombre ?? crudo) : crudo
    const punto: PuntoGrafico = { [bloque.eje_x]: etiqueta }
    for (const clave of bloque.series) {
      const valor = fila[clave] ?? null
      punto[clave] = typeof valor === 'number' ? valor : null
    }
    return punto
  })
}

/** Marca del eje Y: los importes en formato compacto ($ 1,5 M) para que entren en el gráfico. */
export function formatearEjeY(valor: number, tipo: ColumnaTabla['tipo']): string {
  if (tipo === 'moneda') {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(valor)
  }
  if (tipo === 'porcentaje') return `${valor.toLocaleString('es-AR')} %`
  return valor.toLocaleString('es-AR')
}

// --- Alias de un mensaje -----------------------------------------------------------------------

/** Todos los alias que aparecen en los mensajes (texto, tarjetas y columnas de tipo alias). */
export function aliasDeMensajes(mensajes: MensajeVisible[]): string[] {
  const encontrados = new Set<string>()
  for (const mensaje of mensajes) {
    aliasEnTexto(mensaje.contenido).forEach((alias) => encontrados.add(alias))
    for (const bloque of mensaje.bloques) {
      if (bloque.tipo === 'tarjeta' || bloque.tipo === 'navegar') {
        if (bloque.alias !== undefined) encontrados.add(bloque.alias)
      } else if (bloque.tipo === 'tabla') {
        const columnasAlias = bloque.columnas.filter((c) => c.tipo === 'alias')
        for (const fila of bloque.filas) {
          for (const columna of columnasAlias) {
            const valor = fila[columna.clave]
            if (typeof valor === 'string') encontrados.add(valor)
          }
        }
      }
    }
  }
  return Array.from(encontrados)
}

// --- Markdown ----------------------------------------------------------------------------------

function escaparMarkdown(texto: string): string {
  return texto.replace(/[\\`*_{}[\]()#+!|<>~-]/g, '\\$&')
}

/**
 * Reemplaza cada alias por un link a su ficha (si ya se resolvió) o por una etiqueta genérica en
 * negrita, listo para pasar por un renderizador de markdown. El nombre se escapa para que un
 * apellido con caracteres especiales no rompa el formato.
 */
/** "Navarro, Camila" pasa a "Camila Navarro": dentro de una frase, la coma de "Apellido, Nombre"
 * se confunde con la que separa a las personas de una lista. */
export function nombreCorrido(nombre: string): string {
  const [apellido, ...resto] = nombre.split(', ')
  return resto.length === 0 ? nombre : `${resto.join(', ')} ${apellido}`
}

export function sustituirAlias(texto: string, porAlias: Record<string, AliasResuelto>): string {
  return partirTextoConAlias(texto)
    .map((trozo) => {
      if (trozo.tipo === 'texto') return trozo.valor
      const resuelto = porAlias[trozo.alias]
      if (resuelto === undefined) return `**${etiquetaGenerica(trozo.alias)}**`
      const ruta = rutaDeEntidad(resuelto.tipo, resuelto.entidad_id)
      const nombre = escaparMarkdown(nombreCorrido(resuelto.nombre))
      return ruta === null ? `**${nombre}**` : `[${nombre}](${ruta})`
    })
    .join('')
}

/** Preguntas de arranque que el rol activo puede hacer. */
export function sugerenciasPermitidas(permisos: Permiso[]): string[] {
  return SUGERENCIAS.filter((s) => tienePermiso(permisos, s.permiso)).map((s) => s.texto)
}

/**
 * Primeros `largo` caracteres del texto, sin dejar a la vista un alias a medio escribir ni una
 * negrita sin cerrar (el markdown se vuelve a armar con cada corte).
 */
export function cortarSeguro(texto: string, largo: number): string {
  if (largo >= texto.length) return texto
  let corte = texto.slice(0, largo)
  const apertura = corte.lastIndexOf('[')
  if (apertura >= 0 && !corte.includes(']', apertura) && texto.includes(']', apertura)) {
    corte = corte.slice(0, apertura)
  }
  const negritas = corte.split('**').length - 1
  return negritas % 2 === 1 ? `${corte.trimEnd()}**` : corte
}

// --- Copia de la respuesta completa ---------------------------------------------------------------

export function formatearKpi(bloque: BloqueKpi): string {
  if (bloque.valor === null) return 'Sin registros'
  if (typeof bloque.valor === 'string') return bloque.valor
  const numero = bloque.valor.toLocaleString('es-AR')
  if (bloque.unidad === '$') return `$ ${numero}`
  return bloque.unidad === '' ? numero : `${numero} ${bloque.unidad}`
}

export type TonoKpi = 'bueno' | 'malo' | 'neutro'

/** Color de un indicador: bueno si la variación va hacia donde es mejor, malo si va al revés. */
export function tonoDeKpi(bloque: BloqueKpi): TonoKpi {
  const variacion = bloque.variacion
  if (variacion === null || variacion === undefined || variacion === 0) return 'neutro'
  if (bloque.mejora === undefined) return 'neutro'
  return (bloque.mejora === 'alza') === variacion > 0 ? 'bueno' : 'malo'
}

export type IconoKpi =
  'dinero' | 'deuda' | 'ausentes' | 'inscripciones' | 'alumnos' | 'tareas' | 'compras' | 'general'

/** Qué ícono lleva un indicador, según de qué trata (por su título y su unidad). */
export function iconoDeKpi(bloque: BloqueKpi): IconoKpi {
  const titulo = sinTildes(bloque.titulo)
  if (titulo.includes('deuda')) return 'deuda'
  if (bloque.unidad === '$') return 'dinero'
  if (titulo.includes('ausente') || titulo.includes('inasisten')) return 'ausentes'
  if (titulo.includes('inscripci')) return 'inscripciones'
  if (titulo.includes('alumno')) return 'alumnos'
  if (titulo.includes('tarea')) return 'tareas'
  if (titulo.includes('solicitud') || titulo.includes('compra')) return 'compras'
  return 'general'
}

/** Columnas de variación o diferencia contra un período anterior: suben bien, bajan mal. */
export function esColumnaDeCambio(columna: ColumnaTabla): boolean {
  return columna.clave.startsWith('variacion') || columna.clave.startsWith('diferencia')
}

/** Variación sin signo (la dirección la dan la flecha y el color): `12,5 %`. */
export function formatearVariacion(variacion: number): string {
  return `${Math.abs(variacion).toLocaleString('es-AR')} %`
}

/** Texto de una celda, con el nombre real en las columnas de alias. */
export function textoDeCelda(
  columna: ColumnaTabla,
  valor: ValorCelda,
  porAlias: Record<string, AliasResuelto>,
): string {
  if (columna.tipo === 'alias' && typeof valor === 'string') {
    return porAlias[valor]?.nombre ?? etiquetaGenerica(valor)
  }
  return formatearCelda(valor, columna.tipo)
}

function escaparHtml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function tablaEnTexto(
  bloque: BloqueTabla,
  porAlias: Record<string, AliasResuelto>,
  soloTabla = false,
): string {
  const encabezado = bloque.columnas.map((c) => c.etiqueta).join('\t')
  const filas = bloque.filas.map((fila) =>
    bloque.columnas.map((c) => textoDeCelda(c, fila[c.clave] ?? null, porAlias)).join('\t'),
  )
  if (soloTabla) return [encabezado, ...filas].join('\n')
  return [bloque.titulo, encabezado, ...filas, `${bloque.periodo} · ${bloque.fuente}`].join('\n')
}

function tablaEnHtml(
  bloque: BloqueTabla,
  porAlias: Record<string, AliasResuelto>,
  soloTabla = false,
): string {
  const celdas = (etiquetas: string[], etiqueta: 'th' | 'td') =>
    `<tr>${etiquetas.map((e) => `<${etiqueta}>${escaparHtml(e)}</${etiqueta}>`).join('')}</tr>`
  const filas = bloque.filas.map((fila) =>
    celdas(
      bloque.columnas.map((c) => textoDeCelda(c, fila[c.clave] ?? null, porAlias)),
      'td',
    ),
  )
  const tabla = `<table>${celdas(
    bloque.columnas.map((c) => c.etiqueta),
    'th',
  )}${filas.join('')}</table>`
  if (soloTabla) return tabla
  return (
    `<p><strong>${escaparHtml(bloque.titulo)}</strong></p>` +
    tabla +
    `<p>${escaparHtml(`${bloque.periodo} · ${bloque.fuente}`)}</p>`
  )
}

/** Solo el encabezado y las filas, sin título ni fuente: pega limpio en una planilla. */
export function armarCopiaTabla(
  bloque: BloqueTabla,
  porAlias: Record<string, AliasResuelto>,
): { texto: string; html: string } {
  return { texto: tablaEnTexto(bloque, porAlias, true), html: tablaEnHtml(bloque, porAlias, true) }
}

/**
 * Lo que se copia de una respuesta: el texto y, debajo, sus indicadores y tablas. Va en dos
 * formatos: texto plano (las tablas con tabuladores, que Excel y Sheets separan en celdas) y HTML
 * (una tabla real al pegar en Word, Docs o un mail).
 */
export function armarCopia(
  contenido: string,
  bloques: Bloque[],
  porAlias: Record<string, AliasResuelto>,
): { texto: string; html: string } {
  const texto = sustituirAlias(contenido, porAlias)
  const partesTexto = [texto]
  const partesHtml = [`<p>${escaparHtml(texto).replace(/\n/g, '<br>')}</p>`]
  for (const bloque of bloques) {
    if (bloque.tipo === 'kpi') {
      const linea = `${bloque.titulo}: ${formatearKpi(bloque)} (${bloque.periodo} · ${bloque.fuente})`
      partesTexto.push(linea)
      partesHtml.push(`<p>${escaparHtml(linea)}</p>`)
    } else if (bloque.tipo === 'tabla') {
      partesTexto.push(tablaEnTexto(bloque, porAlias))
      partesHtml.push(tablaEnHtml(bloque, porAlias))
    }
  }
  return { texto: partesTexto.join('\n\n'), html: partesHtml.join('') }
}
