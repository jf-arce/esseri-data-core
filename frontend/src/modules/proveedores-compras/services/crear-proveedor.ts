import { apiClient } from '@/api/client'
import type { CrearProveedorPayload, Proveedor } from '@/modules/proveedores-compras/types'

export function crearProveedor(datos: CrearProveedorPayload) {
  return apiClient<Proveedor>('/proveedores-compras/proveedores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
