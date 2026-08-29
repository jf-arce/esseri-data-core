import { apiClient } from '@/api/client'
import type { ActualizarProveedorPayload, Proveedor } from '@/modules/proveedores-compras/types'

export function actualizarProveedor(proveedorId: string, datos: ActualizarProveedorPayload) {
  return apiClient<Proveedor>(`/proveedores-compras/proveedores/${proveedorId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
