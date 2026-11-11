import type { EstadoSolicitudPeriodo, TipoAsistencia } from '@/modules/academico/types'

export const VARIANTE_ESTADO_SOLICITUD_PERIODO = {
  pendiente: 'advertencia',
  aprobada: 'exito',
  rechazada: 'error',
  cancelada: 'neutro',
  revocada: 'neutro',
} as const satisfies Record<EstadoSolicitudPeriodo, 'advertencia' | 'exito' | 'error' | 'neutro'>

export const MOTIVOS_JUSTIFICACION = [
  { value: 'enfermedad', label: 'Enfermedad' },
  { value: 'certificado_medico', label: 'Certificado médico' },
  { value: 'turno_estudio_medico', label: 'Turno/estudio médico' },
  { value: 'viaje_familiar', label: 'Viaje familiar' },
  { value: 'motivo_familiar_personal', label: 'Motivo familiar/personal' },
  { value: 'actividad_autorizada_esseri', label: 'Actividad autorizada ESSERI' },
  { value: 'otro', label: 'Otro' },
] as const

const ETIQUETAS_MOTIVO_JUSTIFICACION = Object.fromEntries(
  MOTIVOS_JUSTIFICACION.map(({ value, label }) => [value, label]),
)

export function etiquetaMotivoJustificacion(motivo: string | null): string {
  if (!motivo) return 'Otro'
  return ETIQUETAS_MOTIVO_JUSTIFICACION[motivo] ?? motivo
}

// Normaliza un texto para comparar búsquedas sin depender de mayúsculas, acentos ni del signo
// de grado: así "3c" encuentra "3°C" y "jose" encuentra "José".
export function normalizarTexto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[°º]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

/** Formatea una franja como "Lun 08:00–09:00" (día 1 = lunes). */
export function formatearHorario(horario: {
  dia_semana: number
  hora_inicio: string
  hora_fin: string
}): string {
  const dia = DIAS_SEMANA[horario.dia_semana - 1] ?? `Día ${horario.dia_semana}`
  return `${dia} ${horario.hora_inicio.slice(0, 5)}–${horario.hora_fin.slice(0, 5)}`
}

export function formatearHorarios(
  horarios: { dia_semana: number; hora_inicio: string; hora_fin: string }[],
): string {
  if (horarios.length === 0) return 'Sin horario'
  return horarios.map(formatearHorario).join(' · ')
}

/** "1 materia" / "2 materias" — conteos de las tarjetas de estructura académica. */
export function pluralizar(cantidad: number, singular: string, pluralForma: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : pluralForma}`
}

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
