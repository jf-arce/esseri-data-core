import { apiClient } from '@/api/client'
import { apiAsignadoTarea } from '@/modules/workflows/constants'
import type { TareaDetalle } from '@/modules/workflows/types'

export function reasignarTarea(id: string, usuarioId: string) {
  return apiClient<TareaDetalle>(apiAsignadoTarea(id), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario_id: usuarioId }),
  })
}
