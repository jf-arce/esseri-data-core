import { apiClient } from '@/api/client'
import type { Permiso } from '@/modules/auth/types'

export function crearPermiso(modulo: string, accion: string, tipoInformacion?: string) {
  return apiClient<Permiso>('/auth/permisos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modulo, accion, tipo_informacion: tipoInformacion }),
  })
}
