import { destinosDe, filtrarNav, NAV_GROUPS } from '@/layout/nav-items'
import type { Permiso } from '@/modules/auth/types'
import {
  RUTA_EJECUCIONES,
  RUTA_NOTIFICACIONES,
  RUTA_REGLAS,
  RUTA_TAREAS,
} from '@/modules/workflows/constants'
import type { EventoSse, MensajeVisible, TipoAlias } from './types'

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
export function rutaDeDestino(
  clave: string,
  rolActivo: string | null,
  permisos: Permiso[],
): string | null {
  const ruta = RUTAS_DE_DESTINO[clave]
  if (ruta === undefined) return null
  const permitidas = destinosDe(filtrarNav(NAV_GROUPS, rolActivo, permisos))
  return permitidas.some((destino) => destino.ruta === ruta) ? ruta : null
}

// Mismas rutas que `busqueda-global.ts` para alumnos y familias.
export function rutaDeEntidad(tipo: TipoAlias, id: string): string {
  const segmento = tipo === 'ALUMNO' ? 'alumnos' : 'familias'
  return `/familias-alumnos/${segmento}/${encodeURIComponent(id)}`
}

// --- Alias -----------------------------------------------------------------------------------

const PATRON_ALIAS = /\[(ALUMNO|FAMILIA):(\d+)\]/g

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
  return null
}

/** Etiqueta neutra mientras el alias no se resolvió, o si el rol no puede ver personas. */
export function etiquetaGenerica(alias: string): string {
  const tipo = tipoDeAlias(alias)
  const numero = alias.match(/:(\d+)\]/)?.[1] ?? ''
  const base = tipo === 'FAMILIA' ? 'Familia' : 'Alumno'
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
