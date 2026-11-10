import type { TipoAsistencia } from '@/modules/academico/types'

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

export type FranjaHoraria = {
  dia_semana: number
  hora_inicio: string
  hora_fin: string
}

export type FranjaOcupada = FranjaHoraria & { materia: string }

export type ConflictoHorario = {
  /** Posición de la franja en conflicto dentro de la lista que se está cargando. */
  indice: number
  /** Materia con la que se pisa; `null` si es otra franja de la misma materia. */
  materia: string | null
  franja: FranjaHoraria
}

/** Mismo día y rangos que se pisan. Franjas contiguas (8–9 y 9–10) no se superponen. */
export function franjasSeSuperponen(a: FranjaHoraria, b: FranjaHoraria): boolean {
  return (
    a.dia_semana === b.dia_semana &&
    a.hora_inicio.slice(0, 5) < b.hora_fin.slice(0, 5) &&
    a.hora_fin.slice(0, 5) > b.hora_inicio.slice(0, 5)
  )
}

/** Franjas que se pisan entre sí o con las de otras materias de la división. */
export function buscarConflictos(
  franjas: FranjaHoraria[],
  ocupadas: FranjaOcupada[],
): ConflictoHorario[] {
  const conflictos: ConflictoHorario[] = []
  franjas.forEach((franja, indice) => {
    const otraMateria = ocupadas.find((ocupada) => franjasSeSuperponen(franja, ocupada))
    if (otraMateria) {
      conflictos.push({ indice, materia: otraMateria.materia, franja: otraMateria })
      return
    }
    const propia = franjas.findIndex((otra, i) => i < indice && franjasSeSuperponen(franja, otra))
    if (propia !== -1) conflictos.push({ indice, materia: null, franja: franjas[propia] })
  })
  return conflictos
}

export function describirConflicto(conflicto: ConflictoHorario): string {
  const franja = formatearHorario(conflicto.franja)
  return conflicto.materia
    ? `La franja ${conflicto.indice + 1} se superpone con ${conflicto.materia} (${franja}).`
    : `La franja ${conflicto.indice + 1} se superpone con otra franja de esta materia (${franja}).`
}

/** El elemento con ese id, o el primero si el id falta o ya no existe. */
export function elegirPorId<T extends { id: string }>(
  items: T[],
  id: string | null | undefined,
): T | undefined {
  return items.find((item) => item.id === id) ?? items[0]
}

const MINUTOS_POR_FILA = 30
const HORA_MINIMA = 7 * 60
const HORA_MAXIMA = 14 * 60

export function aMinutos(hora: string): number {
  const [horas, minutos] = hora.split(':')
  return Number(horas) * 60 + Number(minutos)
}

export function deMinutos(minutos: number): string {
  const horas = String(Math.floor(minutos / 60)).padStart(2, '0')
  return `${horas}:${String(minutos % 60).padStart(2, '0')}`
}

export type BloqueHorario<T extends FranjaHoraria> = {
  clave: string
  origen: T
  /** Columna de la grilla (1 es la de las horas). */
  columna: number
  /** Líneas de la grilla (1 es el encabezado de días). */
  filaInicio: number
  filaFin: number
  superpuesto: boolean
}

export type Grilla<T extends FranjaHoraria> = {
  dias: number[]
  /** Hora de la primera fila, en minutos. */
  inicio: number
  /** Cantidad de filas de 30 minutos. */
  filas: number
  bloques: BloqueHorario<T>[]
}

/**
 * Posiciona franjas en una grilla semanal: lunes a viernes (más sábado y domingo solo si hay
 * franjas), filas de 30 minutos entre 07:00 y 14:00 como mínimo, ampliadas a la hora completa
 * más cercana si alguna franja queda afuera.
 */
export function calcularGrilla<T extends FranjaHoraria>(franjas: T[]): Grilla<T> {
  const diasConFranjas = franjas.map((franja) => franja.dia_semana)
  const dias = [1, 2, 3, 4, 5, 6, 7].filter((dia) => dia <= 5 || diasConFranjas.includes(dia))

  const comienzos = franjas.map((franja) => aMinutos(franja.hora_inicio))
  const finales = franjas.map((franja) => aMinutos(franja.hora_fin))
  const inicio = Math.floor(Math.min(HORA_MINIMA, ...comienzos) / 60) * 60
  const fin = Math.ceil(Math.max(HORA_MAXIMA, ...finales) / 60) * 60

  const bloques = franjas.map((franja, indice) => ({
    clave: `${indice}-${franja.dia_semana}-${franja.hora_inicio}`,
    origen: franja,
    columna: 2 + dias.indexOf(franja.dia_semana),
    filaInicio: 2 + (aMinutos(franja.hora_inicio) - inicio) / MINUTOS_POR_FILA,
    filaFin: 2 + (aMinutos(franja.hora_fin) - inicio) / MINUTOS_POR_FILA,
    superpuesto: franjas.some((otra, i) => i !== indice && franjasSeSuperponen(franja, otra)),
  }))

  return { dias, inicio, filas: (fin - inicio) / MINUTOS_POR_FILA, bloques }
}
