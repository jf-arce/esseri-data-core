import { apiClient } from '@/api/client'
import type { ProveedorDeProducto } from '@/modules/proveedores-compras/types'

export function asociarProveedorAProducto(productoId: string, proveedorId: string) {
  return apiClient<ProveedorDeProducto>(
    `/proveedores-compras/productos/${productoId}/proveedores`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proveedor_id: proveedorId }),
    },
  )
}
