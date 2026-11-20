import { apiClient } from '@/api/client'
import type { DeudaFamiliasListado, FiltrosDeudaFamilias } from '@/modules/facturacion/types'

export function listarDeudaFamilias(filtros: FiltrosDeudaFamilias, signal?: AbortSignal) {
  const parametros = new URLSearchParams({
    pagina: String(filtros.pagina),
    tamanio: String(filtros.tamanio),
  })
  if (filtros.estado) parametros.set('estado', filtros.estado)
  if (filtros.buscar?.trim()) parametros.set('buscar', filtros.buscar.trim())
  if (filtros.ciclo_lectivo) parametros.set('ciclo_lectivo', filtros.ciclo_lectivo)

  return apiClient<DeudaFamiliasListado>(`/facturacion/deudas/familias?${parametros}`, {
    signal,
  })
}
