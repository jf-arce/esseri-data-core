import { apiClient } from '@/api/client'
import type { FiltrosOrdenesBusqueda, OrdenListado } from '@/modules/proveedores-compras/types'

export function buscarOrdenes(filtros: FiltrosOrdenesBusqueda, signal?: AbortSignal) {
  const parametros = new URLSearchParams({
    pagina: String(filtros.pagina),
    tamanio_pagina: String(filtros.tamanioPagina),
  })
  if (filtros.buscar?.trim()) parametros.set('buscar', filtros.buscar.trim())
  if (filtros.estado) parametros.set('estado', filtros.estado)

  return apiClient<OrdenListado>(`/proveedores-compras/ordenes-buscar?${parametros.toString()}`, {
    signal,
  })
}
