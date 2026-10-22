import { apiClient } from '@/api/client'
import type { ExcepcionVencimiento, ExcepcionVencimientoPayload } from '@/modules/facturacion/types'

export function crearExcepcionVencimiento(familiaId: string, datos: ExcepcionVencimientoPayload) {
  return apiClient<ExcepcionVencimiento>(
    `/facturacion/familias/${familiaId}/excepciones-vencimiento`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    },
  )
}
