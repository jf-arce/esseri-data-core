import { apiClient } from '@/api/client'
import type { ArchivoDebitos } from '@/modules/facturacion/types'

export function descargarIncidenciasDebitos(importacionId: string) {
  return apiClient<ArchivoDebitos>(
    `/facturacion/cobranzas-simuladas/importaciones/${importacionId}/incidencias`,
  )
}
