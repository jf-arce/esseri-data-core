import { apiClient } from '@/api/client'
import type { FiltrosOrdenesBusqueda, OrdenListado } from '@/modules/proveedores-compras/types'

export function buscarOrdenes(filtros: FiltrosOrdenesBusqueda, signal?: AbortSignal) {
  const parametros = new URLSearchParams({
    pagina: String(filtros.pagina),
    tamanio_pagina: String(filtros.tamanioPagina),
  })
  if (filtros.buscar?.trim()) parametros.set('buscar', filtros.buscar.trim())
  if (filtros.estado) parametros.set('estado', filtros.estado)
  if (filtros.proveedorId) parametros.set('proveedor_id', filtros.proveedorId)
  if (filtros.desde) parametros.set('desde', filtros.desde)
  if (filtros.hasta) parametros.set('hasta', filtros.hasta)
  if (filtros.itemsMin?.trim()) parametros.set('items_min', filtros.itemsMin.trim())
  if (filtros.itemsMax?.trim()) parametros.set('items_max', filtros.itemsMax.trim())
  if (filtros.orden) parametros.set('orden', filtros.orden)

  return apiClient<OrdenListado>(`/proveedores-compras/ordenes-buscar?${parametros.toString()}`, {
    signal,
  })
}
