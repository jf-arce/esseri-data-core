import { apiClient } from '@/api/client'
import { apiEstadoTarea } from '@/modules/workflows/constants'
import type { TareaDetalle } from '@/modules/workflows/types'

export function cambiarEstadoTarea(id: string, estado: 'en_progreso' | 'completada') {
  return apiClient<TareaDetalle>(apiEstadoTarea(id), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado }),
  })
}
