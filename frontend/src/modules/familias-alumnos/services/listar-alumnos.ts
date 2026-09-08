import { apiClient } from '@/api/client'
import type { Alumno, FiltrosListarAlumnos } from '../types'

export function listarAlumnos(filtros?: FiltrosListarAlumnos) {
  const params = new URLSearchParams()
  if (filtros?.buscar) params.set('buscar', filtros.buscar)
  if (filtros?.estado) params.set('estado', filtros.estado)
  if (filtros?.nivel_educativo_id) params.set('nivel_educativo_id', filtros.nivel_educativo_id)
  if (filtros?.estado_deuda) params.set('estado_deuda', filtros.estado_deuda)
  if (filtros?.estado_inscripcion) params.set('estado_inscripcion', filtros.estado_inscripcion)
  const qs = params.toString() ? `?${params.toString()}` : ''
  return apiClient<Alumno[]>(`/familias-alumnos/alumnos${qs}`)
}
