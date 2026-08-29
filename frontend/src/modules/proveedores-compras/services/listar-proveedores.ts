import { apiClient } from '@/api/client'
import type { Proveedor } from '@/modules/proveedores-compras/types'

export function listarProveedores() {
  return apiClient<Proveedor[]>('/proveedores-compras/proveedores')
}
