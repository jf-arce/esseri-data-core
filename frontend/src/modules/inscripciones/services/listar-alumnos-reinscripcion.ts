import { apiClient } from '@/api/client'
import type { AlumnoReinscripcionOpcion } from '@/modules/inscripciones/types'

export function listarAlumnosReinscripcion(cicloLectivo: string, buscar?: string) {
  const params = new URLSearchParams({ ciclo_lectivo: cicloLectivo, limite: '50' })
  if (buscar?.trim()) params.set('buscar', buscar.trim())

  return apiClient<AlumnoReinscripcionOpcion[]>(
    `/inscripciones/opciones/reinscripciones?${params.toString()}`,
  )
}
