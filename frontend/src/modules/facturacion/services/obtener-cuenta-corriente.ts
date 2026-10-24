import { apiClient } from '@/api/client'
import type { CuentaCorriente } from '@/modules/facturacion/types'

export function obtenerCuentaCorriente(alumnoId: string, signal?: AbortSignal) {
  return apiClient<CuentaCorriente>(
    `/facturacion/alumnos/${encodeURIComponent(alumnoId)}/cuenta-corriente`,
    { signal },
  )
}
