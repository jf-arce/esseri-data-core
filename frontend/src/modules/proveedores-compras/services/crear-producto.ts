import { apiClient } from '@/api/client'
import type { CrearProductoPayload, ProductoServicio } from '@/modules/proveedores-compras/types'

export function crearProducto(datos: CrearProductoPayload) {
  return apiClient<ProductoServicio>('/proveedores-compras/productos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
