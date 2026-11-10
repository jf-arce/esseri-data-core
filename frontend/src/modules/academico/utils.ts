import type { CSSProperties } from 'react'
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

/** Formatea una franja como "Lun 08:00 a 09:00", sin guiones. */
export function formatearFranjaLegible(horario: {
  dia_semana: number
  hora_inicio: string
  hora_fin: string
}): string {
  const dia = DIAS_SEMANA[horario.dia_semana - 1] ?? `Día ${horario.dia_semana}`
  return `${dia} ${horario.hora_inicio.slice(0, 5)} a ${horario.hora_fin.slice(0, 5)}`
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

export type ColorMateria = {
  /** Fondo del bloque y texto con buen contraste. */
  estilo: CSSProperties
  /** Franja izquierda de las tarjetas. */
  estiloBorde: CSSProperties
}

// Sin rojo: queda reservado para marcar horarios superpuestos.
export const COLORES_SUGERIDOS = [
  '#2563eb',
  '#0d9488',
  '#16a34a',
  '#ca8a04',
  '#ea580c',
  '#9333ea',
  '#db2777',
  '#0891b2',
  '#4f46e5',
  '#65a30d',
  '#7c3aed',
  '#0284c7',
]

const HEX_COMPLETO = /^#[0-9a-f]{6}$/
const COLOR_NEUTRO = '#64748b'

/** Hexadecimal al azar con tono, saturación y luminosidad agradables y sin rojo. */
export function hexAleatorio(): string {
  const tono = 20 + Math.random() * 320
  const saturacion = 0.65 + Math.random() * 0.2
  const luminosidad = 0.42 + Math.random() * 0.1
  const canal = (n: number) => {
    const k = (n + tono / 30) % 12
    const a = saturacion * Math.min(luminosidad, 1 - luminosidad)
    const valor = luminosidad - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(valor * 255)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${canal(0)}${canal(8)}${canal(4)}`
}

/** Uno de los colores sugeridos, al azar: es el valor inicial al crear una materia. */
export function colorAleatorio(): string {
  return COLORES_SUGERIDOS[Math.floor(Math.random() * COLORES_SUGERIDOS.length)]
}

/** "#abc" o "#AABBCC" a "#aabbcc"; null si no es un color de 3 o 6 dígitos. */
export function normalizarHex(valor: string): string | null {
  const limpio = valor.trim().toLowerCase()
  const conAlmohadilla = limpio.startsWith('#') ? limpio : `#${limpio}`
  if (/^#[0-9a-f]{3}$/.test(conAlmohadilla)) {
    const [, r, g, b] = conAlmohadilla
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return HEX_COMPLETO.test(conAlmohadilla) ? conAlmohadilla : null
}

/** Texto blanco o negro, el que mejor contraste (WCAG) tenga sobre el color de fondo. */
export function colorTextoLegible(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const canal = parseInt(hex.slice(i, i + 2), 16) / 255
    return canal <= 0.03928 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4
  })
  const luminancia = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const contrasteConBlanco = 1.05 / (luminancia + 0.05)
  const contrasteConNegro = (luminancia + 0.05) / 0.05
  return contrasteConBlanco >= contrasteConNegro ? '#ffffff' : '#000000'
}

/** Estilos de una materia a partir de su color; un valor inválido cae a un gris neutro. */
export function colorMateria(color: string | null | undefined): ColorMateria {
  const hex = color && HEX_COMPLETO.test(color) ? color : COLOR_NEUTRO
  return {
    estilo: { backgroundColor: hex, color: colorTextoLegible(hex) },
    estiloBorde: { borderLeftColor: hex },
  }
}
