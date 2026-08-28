import { apiClient } from '@/api/client'
import type { CambioMatriculaPayload, InscripcionRead } from '@/modules/inscripciones/types'

export function registrarCambioMatricula(inscripcionId: string, datos: CambioMatriculaPayload) {
  return apiClient<InscripcionRead>(`/inscripciones/${inscripcionId}/cambios-matricula`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
}
