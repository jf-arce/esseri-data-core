import type { TipoAsistencia } from '@/modules/academico/types'

const ETIQUETAS_TIPO_ASISTENCIA: Record<TipoAsistencia, string> = {
  presente: 'Presente',
  tardanza: 'Tardanza',
  ausente_pendiente: 'Ausente pendiente',
  ausente_justificado: 'Ausente justificado',
  ausente_injustificado: 'Ausente injustificado',
}

export function etiquetaTipoAsistencia(tipo: TipoAsistencia): string {
  return ETIQUETAS_TIPO_ASISTENCIA[tipo]
}

// Mismo mapeo de color que el mockup de "Historial de asistencia": tardanza/pendiente en
// advertencia, justificado en éxito, injustificado en error.
const VARIANTE_TIPO_ASISTENCIA: Record<TipoAsistencia, 'exito' | 'advertencia' | 'error'> = {
  presente: 'exito',
  tardanza: 'advertencia',
  ausente_pendiente: 'advertencia',
  ausente_justificado: 'exito',
  ausente_injustificado: 'error',
}

export function variantePorTipoAsistencia(tipo: TipoAsistencia): 'exito' | 'advertencia' | 'error' {
  return VARIANTE_TIPO_ASISTENCIA[tipo]
}
