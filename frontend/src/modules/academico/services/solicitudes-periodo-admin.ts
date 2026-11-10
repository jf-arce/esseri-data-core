import { apiClient } from '@/api/client'
import { descargarExport } from '@/lib/descargar-export'
import type {
  FiltrosSolicitudesPeriodo,
  SolicitudAusenciaPeriodoAdmin,
  SolicitudesPeriodoPaginadas,
} from '@/modules/academico/types'

function parametros(filtros: FiltrosSolicitudesPeriodo) {
  const params = new URLSearchParams()
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== '') params.set(clave, String(valor))
  }
  return params
}

export function listarSolicitudesPeriodo(filtros: FiltrosSolicitudesPeriodo = {}) {
  const qs = parametros(filtros).toString()
  return apiClient<SolicitudesPeriodoPaginadas>(
    `/academico/solicitudes-ausencia${qs ? `?${qs}` : ''}`,
  )
}

export function resolverSolicitudPeriodo(id: string, aprobar: boolean, observacion?: string) {
  return apiClient<SolicitudAusenciaPeriodoAdmin>(
    `/academico/solicitudes-ausencia/${id}/resolver`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aprobar, ...(observacion ? { observacion } : {}) }),
    },
  )
}

export function revocarSolicitudPeriodo(id: string, motivo: string, notificarFamilia: boolean) {
  return apiClient<SolicitudAusenciaPeriodoAdmin>(`/academico/solicitudes-ausencia/${id}/revocar`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ motivo, notificar_familia: notificarFamilia }),
  })
}

export function descargarComprobanteSolicitudPeriodoAdmin(
  id: string,
  nombre: string,
): Promise<void> {
  return descargarExport(`/academico/solicitudes-ausencia/${id}/archivo`, nombre)
}
