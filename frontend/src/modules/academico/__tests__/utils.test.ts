import { describe, expect, it } from 'vitest'
import { formatearHorario, formatearHorarios, normalizarTexto } from '../utils'

describe('normalizarTexto', () => {
  it('ignora mayúsculas, acentos y espacios sobrantes', () => {
    expect(normalizarTexto('  JOSÉ  ')).toBe('jose')
    expect(normalizarTexto('Matemática')).toBe('matematica')
    expect(normalizarTexto('  Nivel   Primario ')).toBe('nivel primario')
  })

  it('quita el signo de grado para poder buscar "3c"', () => {
    expect(normalizarTexto('3°C')).toBe('3c')
    expect(normalizarTexto('3ºC')).toBe('3c')
  })
})

describe('formatearHorarios', () => {
  const franja = { dia_semana: 1, hora_inicio: '08:00:00', hora_fin: '09:30:00' }

  it('formatea una franja con día abreviado y horas cortas', () => {
    expect(formatearHorario(franja)).toBe('Lun 08:00–09:30')
  })

  it('une varias franjas y avisa cuando no hay horario', () => {
    expect(
      formatearHorarios([franja, { dia_semana: 3, hora_inicio: '10:00:00', hora_fin: '11:00:00' }]),
    ).toBe('Lun 08:00–09:30 · Mié 10:00–11:00')
    expect(formatearHorarios([])).toBe('Sin horario')
  })

  it('no rompe con un día fuera de rango', () => {
    expect(formatearHorario({ ...franja, dia_semana: 9 })).toBe('Día 9 08:00–09:30')
  })
})
