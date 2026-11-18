import type { AliasResuelto, MensajeVisible, TipoAlias } from '../types'
import { rutaDeEntidad } from './destinos'
import { escaparMarkdown } from './texto'

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
