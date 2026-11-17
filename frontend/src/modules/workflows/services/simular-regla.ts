import { apiClient } from '@/api/client'
import { API_SIMULAR_REGLA } from '@/modules/workflows/constants'
import type { Simulacion, SimulacionPayload } from '@/modules/workflows/types'

/** Prueba un borrador contra un evento real. No escribe nada en el backend. */
export function simularRegla(datos: SimulacionPayload, signal?: AbortSignal) {
  return apiClient<Simulacion>(API_SIMULAR_REGLA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
    signal,
  })
}
