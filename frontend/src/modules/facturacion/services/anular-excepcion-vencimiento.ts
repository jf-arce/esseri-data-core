import { apiClient } from '@/api/client'
import type { ExcepcionVencimiento } from '@/modules/facturacion/types'

export function anularExcepcionVencimiento(id: string) {
  return apiClient<ExcepcionVencimiento>(`/facturacion/excepciones-vencimiento/${id}/anular`, {
    method: 'POST',
  })
}
