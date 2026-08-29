import { apiClient } from '@/api/client'
import type { OrdenCompra } from '@/modules/proveedores-compras/types'

// Unico cambio de estado manual: `recibida` lo define la recepcion de compras (#111), no una
// edicion a mano, y el backend rechaza cualquier otro destino desde este endpoint.
export function cancelarOrden(ordenId: string) {
  return apiClient<OrdenCompra>(`/proveedores-compras/ordenes/${ordenId}/estado`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado: 'cancelada' }),
  })
}
