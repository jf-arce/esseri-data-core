import type { AliasResuelto, Bloque, BloqueTabla } from '../types'
import { sustituirAlias } from './alias'
import { formatearKpi } from './kpi'
import { textoDeCelda } from './tablas'

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
