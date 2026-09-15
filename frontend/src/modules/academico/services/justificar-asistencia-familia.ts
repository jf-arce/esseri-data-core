import { apiClient } from '@/api/client'
import type { JustificacionFamilia } from '../types'

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
  return apiClient<JustificacionFamilia>(
    `/academico/familia/asistencias/${asistenciaId}/justificaciones`,
    {
      method: 'POST',
      body: cuerpo,
    },
  )
}
