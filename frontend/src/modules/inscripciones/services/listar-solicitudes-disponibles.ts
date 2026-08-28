import { apiClient } from '@/api/client'
import type { SolicitudInscripcionOpcion } from '@/modules/inscripciones/types'

export function listarSolicitudesDisponibles(buscar?: string) {
  const params = new URLSearchParams({ limite: '50' })
  if (buscar?.trim()) params.set('buscar', buscar.trim())

  return apiClient<SolicitudInscripcionOpcion[]>(
    `/inscripciones/opciones/solicitudes?${params.toString()}`,
  )
}
