import { apiClient } from '@/api/client'

export function justificarAsistenciaFamilia(
  asistenciaId: string,
  motivo: string,
  observacion: string,
) {
  return apiClient(`/academico/familia/asistencias/${asistenciaId}/justificaciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ motivo, observacion: observacion || null }),
  })
}
