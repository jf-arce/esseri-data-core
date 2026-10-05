import { apiClient } from '@/api/client'
import type { ProveedorDeProducto } from '@/modules/proveedores-compras/types'

export function listarProveedoresDeProducto(productoId: string) {
  return apiClient<ProveedorDeProducto[]>(
    `/proveedores-compras/productos/${productoId}/proveedores`,
  )
}
