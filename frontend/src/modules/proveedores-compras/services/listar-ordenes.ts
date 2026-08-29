import { apiClient } from '@/api/client'
import type { OrdenCompra } from '@/modules/proveedores-compras/types'

export function listarOrdenes() {
  return apiClient<OrdenCompra[]>('/proveedores-compras/ordenes')
}
