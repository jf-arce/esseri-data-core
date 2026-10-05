import { apiClient } from '@/api/client'
import type { PrecioProducto } from '@/modules/proveedores-compras/types'

export function listarPreciosDeProducto(productoId: string) {
  return apiClient<PrecioProducto[]>(`/proveedores-compras/productos/${productoId}/precios`)
}
