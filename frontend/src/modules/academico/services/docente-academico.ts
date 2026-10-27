import { apiClient } from '@/api/client'
import type { InscripcionListado } from '@/modules/inscripciones/types'
import type { SeguimientoDivisionItem } from '../types'

export interface PerfilDocenteActual {
  nombre: string
  apellido: string
}

export function obtenerPerfilDocenteActual() {
  return apiClient<PerfilDocenteActual>('/academico/docentes/me/perfil')
}

export function listarAlumnosDivisionDocente(divisionId: string, cicloLectivo: string) {
  const params = new URLSearchParams({ ciclo_lectivo: cicloLectivo })
  return apiClient<InscripcionListado>(
    `/academico/docentes/me/divisiones/${divisionId}/alumnos?${params.toString()}`,
  )
}

export function obtenerSeguimientoDivisionDocente(divisionId: string, cicloLectivo: string) {
  const params = new URLSearchParams({ ciclo_lectivo: cicloLectivo })
  return apiClient<SeguimientoDivisionItem[]>(
    `/academico/docentes/me/divisiones/${divisionId}/seguimiento?${params.toString()}`,
  )
}
