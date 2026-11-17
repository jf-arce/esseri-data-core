export function escaparMarkdown(texto: string): string {
  return texto.replace(/[\\`*_{}[\]()#+!|<>~-]/g, '\\$&')
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
