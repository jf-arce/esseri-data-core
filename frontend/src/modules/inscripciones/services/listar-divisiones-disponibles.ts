import { apiClient } from '@/api/client'
import type { DivisionOpcion } from '@/modules/inscripciones/types'

export function listarDivisionesDisponibles() {
  return apiClient<DivisionOpcion[]>('/inscripciones/opciones/divisiones')
}
