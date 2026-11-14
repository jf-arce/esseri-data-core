import type { CSSProperties } from 'react'
import type {
  Anio,
  Division,
  EstadoSolicitudPeriodo,
  FranjaConMateria,
  MateriaCurso,
  TipoAsistencia,
} from '@/modules/academico/types'

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

export const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

/** "08:00 a 09:00" a partir de una franja. */
export function rangoLegible(franja: { hora_inicio: string; hora_fin: string }): string {
  return `${franja.hora_inicio.slice(0, 5)} a ${franja.hora_fin.slice(0, 5)}`
}

/** "Pérez, Ana" a "A. Pérez"; con varios docentes, "A. Pérez · L. Gómez". Sin docentes, `null`. */
export function abreviarDocentes(docentes: string[]): string | null {
  if (docentes.length === 0) return null
  return docentes
    .map((docente) => {
      const [apellido, nombre] = docente.split(', ')
      return nombre ? `${nombre.charAt(0)}. ${apellido}` : docente
    })
    .join(' · ')
}

/** Ausencia aún no justificada, o con justificación todavía en revisión. */
export function esAusenciaPendienteDeJustificar(asistencia: {
  tipo: string
  justificacion_estado?: string | null
}): boolean {
  return (
    asistencia.tipo === 'ausente_pendiente' &&
    (!asistencia.justificacion_estado || asistencia.justificacion_estado === 'pendiente')
  )
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

/** Si el destino se pisa con alguna franja visible, ignorando la propia (`idPropio`). */
export function franjaChoca(
  franjas: (FranjaHoraria & { id: string })[],
  destino: FranjaHoraria,
  idPropio?: string,
): boolean {
  return franjas.some((otra) => otra.id !== idPropio && franjasSeSuperponen(destino, otra))
}

/** Aviso de choque que nombra la materia del curso con la que se pisa el destino. */
export function mensajeChoque(
  franjas: FranjaConMateria[],
  destino: FranjaHoraria,
  idPropio?: string,
): string {
  const otra = franjas.find((f) => f.id !== idPropio && franjasSeSuperponen(destino, f))
  return otra
    ? `Ese horario se pisa con ${otra.materiaCurso.materia_nombre} (${formatearHorario(otra)}) en este curso.`
    : 'Ese horario se pisa con otra materia de este curso.'
}

/**
 * Primera franja de una hora (lunes a sábado, de 08:00 a 22:00) que no se pisa con `ocupadas`.
 * Si no queda ninguna libre, devuelve la primera hora del lunes.
 */
export function primeraFranjaLibre(ocupadas: FranjaHoraria[]): FranjaHoraria {
  const aHora = (hora: number) => `${String(hora).padStart(2, '0')}:00`
  for (let dia = 1; dia <= 6; dia++) {
    for (let hora = 8; hora < 22; hora++) {
      const candidata = { dia_semana: dia, hora_inicio: aHora(hora), hora_fin: aHora(hora + 1) }
      if (!ocupadas.some((ocupada) => franjasSeSuperponen(candidata, ocupada))) return candidata
    }
  }
  return { dia_semana: 1, hora_inicio: '08:00', hora_fin: '09:00' }
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
    ? `El horario ${conflicto.indice + 1} se pisa con ${conflicto.materia} (${franja}) en este curso.`
    : `El horario ${conflicto.indice + 1} se pisa con otro horario de esta materia (${franja}).`
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
  /** Día de la semana (1 = lunes). */
  dia: number
  superpuesto: boolean
}

export type RangoGrilla = {
  dias: number[]
  /** Hora de la primera fila, en minutos. */
  inicio: number
  /** Fin de la última fila, en minutos. */
  fin: number
}

export type Grilla<T extends FranjaHoraria> = {
  dias: number[]
  /** Hora de la primera fila, en minutos. */
  inicio: number
  /** Fin de la última fila, en minutos. */
  fin: number
  /** Cantidad de filas de 30 minutos. */
  filas: number
  bloques: BloqueHorario<T>[]
}

/**
 * Posiciona franjas en una grilla semanal: lunes a viernes (más sábado y domingo solo si hay
 * franjas), filas de 30 minutos entre 07:00 y 14:00 como mínimo, ampliadas a la hora completa
 * más cercana si alguna franja queda afuera. `rangoMinimo` se une al rango calculado, nunca
 * lo achica: sirve para que la grilla no cambie de escala mientras se arrastra un bloque.
 */
export function calcularGrilla<T extends FranjaHoraria>(
  franjas: T[],
  rangoMinimo?: RangoGrilla,
): Grilla<T> {
  const diasConFranjas = franjas.map((franja) => franja.dia_semana)
  const dias = [1, 2, 3, 4, 5, 6, 7].filter(
    (dia) => dia <= 5 || diasConFranjas.includes(dia) || rangoMinimo?.dias.includes(dia),
  )

  const comienzos = franjas.map((franja) => aMinutos(franja.hora_inicio))
  const finales = franjas.map((franja) => aMinutos(franja.hora_fin))
  const inicio =
    Math.floor(Math.min(HORA_MINIMA, rangoMinimo?.inicio ?? HORA_MINIMA, ...comienzos) / 60) * 60
  const fin =
    Math.ceil(Math.max(HORA_MAXIMA, rangoMinimo?.fin ?? HORA_MAXIMA, ...finales) / 60) * 60

  const bloques = franjas.map((franja, indice) => ({
    clave: `${indice}-${franja.dia_semana}-${franja.hora_inicio}`,
    origen: franja,
    dia: franja.dia_semana,
    superpuesto: franjas.some((otra, i) => i !== indice && franjasSeSuperponen(franja, otra)),
  }))

  return { dias, inicio, fin, filas: (fin - inicio) / MINUTOS_POR_FILA, bloques }
}

/** Posición vertical de una franja dentro de la columna del día, en porcentaje. */
export function posicionBloque(
  franja: Pick<FranjaHoraria, 'hora_inicio' | 'hora_fin'>,
  grilla: Pick<RangoGrilla, 'inicio' | 'fin'>,
): { top: number; alto: number } {
  const total = grilla.fin - grilla.inicio
  const desde = aMinutos(franja.hora_inicio)
  const hasta = aMinutos(franja.hora_fin)
  return { top: ((desde - grilla.inicio) / total) * 100, alto: ((hasta - desde) / total) * 100 }
}

export type CarrilBloque = { carril: number; carriles: number }

/**
 * Reparte en carriles las franjas de un día que se pisan, para dibujarlas lado a lado. Cada
 * grupo de solapamiento transitivo (A pisa a B y B pisa a C) comparte la misma cantidad de
 * carriles; las franjas contiguas (8–9 y 9–10) no se consideran solapadas.
 */
export function particionarSolapados(franjas: FranjaHoraria[]): CarrilBloque[] {
  const orden = franjas
    .map((franja, indice) => ({
      indice,
      inicio: aMinutos(franja.hora_inicio),
      fin: aMinutos(franja.hora_fin),
    }))
    .sort((a, b) => a.inicio - b.inicio || a.fin - b.fin)
  const resultado: CarrilBloque[] = franjas.map(() => ({ carril: 0, carriles: 1 }))

  let grupo: number[] = []
  let finDelGrupo = -1
  let finPorCarril: number[] = []

  function cerrarGrupo() {
    for (const indice of grupo) resultado[indice].carriles = finPorCarril.length
    grupo = []
    finPorCarril = []
  }

  for (const franja of orden) {
    if (grupo.length > 0 && franja.inicio >= finDelGrupo) cerrarGrupo()
    let carril = finPorCarril.findIndex((fin) => fin <= franja.inicio)
    if (carril === -1) carril = finPorCarril.length
    finPorCarril[carril] = franja.fin
    resultado[franja.indice].carril = carril
    grupo.push(franja.indice)
    finDelGrupo = Math.max(finDelGrupo, franja.fin)
  }
  cerrarGrupo()
  return resultado
}

/** Minutos (ajustados a la fila de 30 de abajo) que corresponden a un punto de la columna. */
export function minutosEnPosicion(
  y: number,
  altoColumna: number,
  grilla: Pick<RangoGrilla, 'inicio' | 'fin'>,
): number {
  const total = grilla.fin - grilla.inicio
  const crudo = grilla.inicio + (y / altoColumna) * total
  const ajustado = Math.floor(crudo / MINUTOS_POR_FILA) * MINUTOS_POR_FILA
  return Math.min(Math.max(ajustado, grilla.inicio), grilla.fin - MINUTOS_POR_FILA)
}

/** Desplazamiento en píxeles a minutos, redondeado a filas de 30. */
export function desplazamientoEnMinutos(
  pixeles: number,
  altoColumna: number,
  grilla: Pick<RangoGrilla, 'inicio' | 'fin'>,
): number {
  const minutos = (pixeles / altoColumna) * (grilla.fin - grilla.inicio)
  return Math.round(minutos / MINUTOS_POR_FILA) * MINUTOS_POR_FILA || 0
}

/**
 * Mueve una franja a otro día y/o desplaza su horario de a 30 minutos, conservando la duración
 * y el desfase (08:40–09:20 pasa a 09:10–09:50). Se detiene en los bordes de la grilla.
 */
export function moverFranja(
  franja: FranjaHoraria,
  desplazamiento: number,
  dia: number,
  grilla: Pick<RangoGrilla, 'inicio' | 'fin'>,
): FranjaHoraria {
  const inicio = aMinutos(franja.hora_inicio)
  const fin = aMinutos(franja.hora_fin)
  const minimo = Math.ceil((grilla.inicio - inicio) / MINUTOS_POR_FILA) * MINUTOS_POR_FILA
  const maximo = Math.floor((grilla.fin - fin) / MINUTOS_POR_FILA) * MINUTOS_POR_FILA
  const delta = Math.min(Math.max(desplazamiento, minimo), Math.max(minimo, maximo))
  return {
    dia_semana: dia,
    hora_inicio: deMinutos(inicio + delta),
    hora_fin: deMinutos(fin + delta),
  }
}

/** Corre el fin de la franja de a 30 minutos: dura 30 minutos como mínimo y llega hasta el fin de la grilla. */
export function estirarFranja(
  franja: FranjaHoraria,
  desplazamiento: number,
  grilla: Pick<RangoGrilla, 'inicio' | 'fin'>,
): FranjaHoraria {
  const inicio = aMinutos(franja.hora_inicio)
  const fin = aMinutos(franja.hora_fin)
  const minimo = Math.ceil((inicio + MINUTOS_POR_FILA - fin) / MINUTOS_POR_FILA) * MINUTOS_POR_FILA
  const maximo = Math.floor((grilla.fin - fin) / MINUTOS_POR_FILA) * MINUTOS_POR_FILA
  const delta = Math.min(Math.max(desplazamiento, minimo), Math.max(minimo, maximo))
  return {
    dia_semana: franja.dia_semana,
    hora_inicio: deMinutos(inicio),
    hora_fin: deMinutos(fin + delta),
  }
}

/** Misma lista de franjas con la de ese id reemplazada: las demás quedan idénticas y en orden. */
export function reemplazarFranja<T extends FranjaHoraria & { id: string }>(
  horarios: T[],
  idFranja: string,
  nueva: FranjaHoraria,
): T[] {
  return horarios.map((horario) => (horario.id === idFranja ? { ...horario, ...nueva } : horario))
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

// "1°A": la división ya puede venir con el año ("1°A"), solo con la letra ("A") o con un
// nombre propio ("Sala A", que queda "1° Sala A").
export function etiquetaDivision(anio: Anio, division: Division): string {
  return etiquetaCurso(anio.numero, division.nombre)
}

export function etiquetaCurso(anioNumero: number, divisionNombre: string): string {
  const prefijo = `${anioNumero}°`
  if (divisionNombre.startsWith(prefijo)) return divisionNombre
  return divisionNombre.length <= 2 ? `${prefijo}${divisionNombre}` : `${prefijo} ${divisionNombre}`
}

// Solo la letra ("A"), para el desplegable que ya tiene el año al lado.
export function letraDivision(anio: Anio, division: Division): string {
  const prefijo = `${anio.numero}°`
  return division.nombre.startsWith(prefijo)
    ? division.nombre.slice(prefijo.length)
    : division.nombre
}

export function textoAlumnos(cantidad: number): string {
  return `${cantidad} ${cantidad === 1 ? 'alumno' : 'alumnos'}`
}

/** Franjas de las materias de la división, salvo la de `excluirId` (la que se está editando). */
export function franjasOcupadas(
  materiasCurso: MateriaCurso[],
  excluirId?: string,
): FranjaOcupada[] {
  return materiasCurso
    .filter((materiaCurso) => materiaCurso.id !== excluirId)
    .flatMap((materiaCurso) =>
      materiaCurso.horarios.map((horario) => ({
        materia: materiaCurso.materia_nombre ?? 'otra materia',
        dia_semana: horario.dia_semana,
        hora_inicio: horario.hora_inicio,
        hora_fin: horario.hora_fin,
      })),
    )
}

/** Nombres de las otras materias de la división cuyas franjas se pisan con las de esta. */
export function materiasEnConflicto(
  materiaCurso: MateriaCurso,
  materiasCurso: MateriaCurso[],
): string[] {
  const nombres = materiasCurso
    .filter(
      (otra) =>
        otra.id !== materiaCurso.id &&
        materiaCurso.horarios.some((franja) =>
          otra.horarios.some((franjaOtra) => franjasSeSuperponen(franja, franjaOtra)),
        ),
    )
    .map((otra) => otra.materia_nombre ?? 'otra materia')
  return [...new Set(nombres)]
}

export type FiltroTipoMateria = 'todos' | 'materia' | 'taller'
export type OrdenMaterias = 'nombre' | 'dia' | 'sin-docente'

export type FiltroMaterias = {
  texto: string
  tipo: FiltroTipoMateria
  orden: OrdenMaterias
}

export const FILTRO_MATERIAS_INICIAL: FiltroMaterias = { texto: '', tipo: 'todos', orden: 'nombre' }

function nombreMateria(materiaCurso: MateriaCurso): string {
  return materiaCurso.materia_nombre ?? ''
}

// Primera franja de la semana como minutos desde el lunes 00:00; sin horario va al final.
function primeraFranja(materiaCurso: MateriaCurso): number {
  const minutos = materiaCurso.horarios.map(
    (horario) => horario.dia_semana * 24 * 60 + aMinutos(horario.hora_inicio),
  )
  return minutos.length > 0 ? Math.min(...minutos) : Number.POSITIVE_INFINITY
}

/** Filtra por texto y tipo, y ordena por nombre, primer día de clase o sin docente primero. */
export function filtrarYOrdenarMaterias(
  materiasCurso: MateriaCurso[],
  filtro: FiltroMaterias,
  cantidadDocentes: (materiaCurso: MateriaCurso) => number,
): MateriaCurso[] {
  const texto = normalizarTexto(filtro.texto)
  const porNombre = (a: MateriaCurso, b: MateriaCurso) =>
    nombreMateria(a).localeCompare(nombreMateria(b), 'es')

  return materiasCurso
    .filter(
      (materiaCurso) =>
        (filtro.tipo === 'todos' || materiaCurso.materia_tipo === filtro.tipo) &&
        normalizarTexto(nombreMateria(materiaCurso)).includes(texto),
    )
    .sort((a, b) => {
      if (filtro.orden === 'dia') {
        const diferencia = primeraFranja(a) - primeraFranja(b)
        if (diferencia !== 0 && !Number.isNaN(diferencia)) return diferencia
      }
      if (filtro.orden === 'sin-docente') {
        const diferencia = Number(cantidadDocentes(a) > 0) - Number(cantidadDocentes(b) > 0)
        if (diferencia !== 0) return diferencia
      }
      return porNombre(a, b)
    })
}

export const SIN_DOCENTE = 'sin-docente'

export type FiltroHorario = {
  texto: string
  tipo: FiltroTipoMateria
  /** `'todos'`, `SIN_DOCENTE` o el nombre de un docente. */
  docente: string
}

export const FILTRO_HORARIO_INICIAL: FiltroHorario = { texto: '', tipo: 'todos', docente: 'todos' }

export function hayFiltroHorario(filtro: FiltroHorario): boolean {
  return filtro.texto !== '' || filtro.tipo !== 'todos' || filtro.docente !== 'todos'
}

/** `true` si la materia pasa el filtro de texto, tipo y docente del horario. */
export function coincideFiltroHorario(
  materiaCurso: MateriaCurso,
  filtro: FiltroHorario,
  docentes: string[],
): boolean {
  const docenteOk =
    filtro.docente === 'todos' ||
    (filtro.docente === SIN_DOCENTE ? docentes.length === 0 : docentes.includes(filtro.docente))
  return (
    docenteOk &&
    (filtro.tipo === 'todos' || materiaCurso.materia_tipo === filtro.tipo) &&
    normalizarTexto(nombreMateria(materiaCurso)).includes(normalizarTexto(filtro.texto))
  )
}

/** Ids de las materias que tienen alguna franja pisada con otra materia de la división. */
export function idsEnConflicto(materiasCurso: MateriaCurso[]): Set<string> {
  return new Set(
    materiasCurso
      .filter((materiaCurso) => materiasEnConflicto(materiaCurso, materiasCurso).length > 0)
      .map((materiaCurso) => materiaCurso.id),
  )
}
