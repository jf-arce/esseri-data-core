import { apiClient } from '@/api/client'

export function justificarAsistenciaFamilia(
  asistenciaId: string,
  motivo: string,
  observacion: string,
  comprobante?: File,
) {
  const cuerpo = new FormData()
  cuerpo.set('motivo', motivo)
  if (observacion) cuerpo.set('observacion', observacion)
  if (comprobante) cuerpo.set('comprobante', comprobante)
  return apiClient(`/academico/familia/asistencias/${asistenciaId}/justificaciones`, {
    method: 'POST',
    body: cuerpo,
  })
}
