import { apiClient } from '@/api/client'
import type { FacturasElegiblesDebitos, FiltrosFacturasDebitos } from '@/modules/facturacion/types'

export function listarFacturasElegiblesDebitos(
  filtros: FiltrosFacturasDebitos,
  signal?: AbortSignal,
) {
  const parametros = new URLSearchParams()
  if (filtros.periodo) parametros.set('periodo', filtros.periodo)
  if (filtros.medio) parametros.set('medio', filtros.medio)
  if (filtros.estado) parametros.set('estado', filtros.estado)
  if (filtros.buscar) parametros.set('buscar', filtros.buscar)
  parametros.set('pagina', String(filtros.pagina))
  parametros.set('tamanio', String(filtros.tamanio))
  return apiClient<FacturasElegiblesDebitos>(
    `/facturacion/cobranzas-simuladas/facturas-elegibles?${parametros.toString()}`,
    { signal },
  )
}
