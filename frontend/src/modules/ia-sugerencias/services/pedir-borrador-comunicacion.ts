import { apiClient } from '@/api/client'
import type { PedidoBorradorComunicacion, Sugerencia } from '@/modules/ia-sugerencias/types'

export function pedirBorradorComunicacion(datos: PedidoBorradorComunicacion) {
  return apiClient<Sugerencia>('/ia-sugerencias/comunicaciones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
