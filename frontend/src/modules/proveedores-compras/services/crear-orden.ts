import { apiClient } from '@/api/client'
import type { CrearOrdenPayload, OrdenCompra } from '@/modules/proveedores-compras/types'

export function crearOrden(datos: CrearOrdenPayload) {
  return apiClient<OrdenCompra>('/proveedores-compras/ordenes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
