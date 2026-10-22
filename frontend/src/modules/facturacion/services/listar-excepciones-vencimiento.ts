import { apiClient } from '@/api/client'
import type { ExcepcionVencimiento } from '@/modules/facturacion/types'

export function listarExcepcionesVencimiento(familiaId: string, signal?: AbortSignal) {
  return apiClient<ExcepcionVencimiento[]>(
    `/facturacion/familias/${familiaId}/excepciones-vencimiento`,
    { signal },
  )
}
