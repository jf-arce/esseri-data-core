import { apiClient } from '@/api/client'
import type { BajaInscripcionPayload, InscripcionRead } from '@/modules/inscripciones/types'

export function registrarBajaInscripcion(inscripcionId: string, datos: BajaInscripcionPayload) {
  return apiClient<InscripcionRead>(`/inscripciones/${inscripcionId}/bajas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
