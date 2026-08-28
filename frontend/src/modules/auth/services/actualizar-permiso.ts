import { apiClient } from '@/api/client'
import type { Permiso } from '@/modules/auth/types'

export function actualizarPermiso(
  permisoId: string,
  datos: { modulo?: string; accion?: string; tipo_informacion?: string | null },
) {
  return apiClient<Permiso>(`/auth/permisos/${permisoId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
