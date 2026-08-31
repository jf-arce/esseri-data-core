import { apiClient } from '@/api/client'
import type { Alumno } from '../types'

export function listarAlumnos() {
  return apiClient<Alumno[]>('/familias-alumnos/alumnos')
}
