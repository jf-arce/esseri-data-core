import { apiClient } from '@/api/client'
import type { Rol } from '@/modules/auth/types'

export function crearRol(nombre: string, descripcion?: string) {
  return apiClient<Rol>('/auth/roles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, descripcion }),
  })
}
