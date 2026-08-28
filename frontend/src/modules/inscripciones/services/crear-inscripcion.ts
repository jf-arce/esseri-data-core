import { apiClient } from '@/api/client'
import type { CrearInscripcionPayload, InscripcionRead } from '@/modules/inscripciones/types'

export function crearInscripcion(datos: CrearInscripcionPayload) {
  return apiClient<InscripcionRead>('/inscripciones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
