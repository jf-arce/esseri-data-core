import { apiClient } from '@/api/client'
import type { OrdenCompra } from '@/modules/proveedores-compras/types'

export function obtenerOrden(ordenId: string, signal?: AbortSignal) {
  return apiClient<OrdenCompra>(`/proveedores-compras/ordenes/${ordenId}`, { signal })
}
