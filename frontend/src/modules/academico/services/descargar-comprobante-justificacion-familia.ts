import { descargarExport } from '@/lib/descargar-export'

export function descargarComprobanteJustificacionFamilia(id: string, nombre: string) {
  return descargarExport(`/academico/familia/justificaciones/${id}/archivo`, nombre)
}
