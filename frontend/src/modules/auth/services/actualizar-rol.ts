import { apiClient } from '@/api/client'
import type { Rol } from '@/modules/auth/types'

export function actualizarRol(rolId: string, datos: { nombre?: string; descripcion?: string }) {
  return apiClient<Rol>(`/auth/roles/${rolId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
