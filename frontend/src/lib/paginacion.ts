export type PaginaVisible = number | 'elipsis'

export function paginasVisibles(totalPaginas: number, paginaActual: number): PaginaVisible[] {
  if (totalPaginas <= 5) {
    return Array.from({ length: totalPaginas }, (_, indice) => indice + 1)
  }

  if (paginaActual <= 3) return [1, 2, 3, 4, 'elipsis', totalPaginas]
  if (paginaActual >= totalPaginas - 2) {
    return [1, 'elipsis', totalPaginas - 3, totalPaginas - 2, totalPaginas - 1, totalPaginas]
  }
  return [1, 'elipsis', paginaActual - 1, paginaActual, paginaActual + 1, 'elipsis', totalPaginas]
}
