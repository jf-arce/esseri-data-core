import { apiClient } from '@/api/client'
import { descargarExport } from '@/lib/descargar-export'
import type { SolicitudAusenciaPeriodo } from '@/modules/academico/types'

export type CrearSolicitudAusenciaPeriodo = {
  alumno_id: string
  fecha_inicio: string
  fecha_fin?: string
  motivo: string
  observacion?: string
  comprobante?: File
}

export type ConfiguracionAusenciasFamilia = {
  dias_limite_justificacion: number
}

/** Ventana vigente de justificación, configurada en el backend. */
export function obtenerConfiguracionAusencias(): Promise<ConfiguracionAusenciasFamilia> {
  return apiClient<ConfiguracionAusenciasFamilia>('/academico/familia/configuracion-ausencias')
}

export function crearSolicitudAusenciaPeriodo(
  datos: CrearSolicitudAusenciaPeriodo,
): Promise<SolicitudAusenciaPeriodo> {
  const formulario = new FormData()
  formulario.append('alumno_id', datos.alumno_id)
  formulario.append('fecha_inicio', datos.fecha_inicio)
  if (datos.fecha_fin) formulario.append('fecha_fin', datos.fecha_fin)
  formulario.append('motivo', datos.motivo)
  if (datos.observacion) formulario.append('observacion', datos.observacion)
  if (datos.comprobante) formulario.append('comprobante', datos.comprobante)

  return apiClient<SolicitudAusenciaPeriodo>('/academico/familia/solicitudes-ausencia', {
    method: 'POST',
    body: formulario,
  })
}

export function listarSolicitudesAusenciaFamilia(
  alumnoId: string,
): Promise<SolicitudAusenciaPeriodo[]> {
  return apiClient<SolicitudAusenciaPeriodo[]>(
    `/academico/familia/alumnos/${alumnoId}/solicitudes-ausencia`,
  )
}

export function cancelarSolicitudAusencia(solicitudId: string): Promise<SolicitudAusenciaPeriodo> {
  return apiClient<SolicitudAusenciaPeriodo>(
    `/academico/familia/solicitudes-ausencia/${solicitudId}/cancelar`,
    { method: 'POST' },
  )
}

export function descargarComprobanteSolicitudAusencia(
  solicitudId: string,
  nombre: string,
): Promise<void> {
  return descargarExport(`/academico/familia/solicitudes-ausencia/${solicitudId}/archivo`, nombre)
}
