import { apiClient } from '@/api/client'
import type { ProductoServicio } from '@/modules/proveedores-compras/types'

export function listarProductos() {
  return apiClient<ProductoServicio[]>('/proveedores-compras/productos')
}
