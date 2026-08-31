import { apiClient } from '@/api/client'
import type { FacturasListado, FiltrosFacturas } from '@/modules/facturacion/types'

export function listarFacturas(filtros: FiltrosFacturas, signal?: AbortSignal) {
  const parametros = new URLSearchParams({
    pagina: String(filtros.pagina),
    tamanio: String(filtros.tamanio),
  })
  if (filtros.estado) parametros.set('estado', filtros.estado)

  return apiClient<FacturasListado>(`/facturacion/facturas?${parametros.toString()}`, { signal })
}
