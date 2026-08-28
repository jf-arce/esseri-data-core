import { apiClient } from '@/api/client'
import type { CrearReinscripcionPayload, InscripcionRead } from '@/modules/inscripciones/types'

export function crearReinscripcion(datos: CrearReinscripcionPayload) {
  return apiClient<InscripcionRead>('/inscripciones/reinscripciones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
