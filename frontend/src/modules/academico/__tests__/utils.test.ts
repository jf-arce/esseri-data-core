import { describe, expect, it } from 'vitest'
import {
  aMinutos,
  buscarConflictos,
  calcularGrilla,
  deMinutos,
  elegirPorId,
  describirConflicto,
  formatearFranjaLegible,
  formatearHorario,
  formatearHorarios,
  franjasSeSuperponen,
  normalizarTexto,
} from '../utils'

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

describe('franjasSeSuperponen', () => {
  const base = { dia_semana: 1, hora_inicio: '08:00', hora_fin: '09:00' }

  it('detecta superposición total y parcial', () => {
    expect(franjasSeSuperponen(base, base)).toBe(true)
    expect(franjasSeSuperponen(base, { ...base, hora_inicio: '08:30', hora_fin: '09:30' })).toBe(
      true,
    )
  })

  it('permite franjas contiguas y de otro día', () => {
    expect(franjasSeSuperponen(base, { ...base, hora_inicio: '09:00', hora_fin: '10:00' })).toBe(
      false,
    )
    expect(franjasSeSuperponen(base, { ...base, dia_semana: 2 })).toBe(false)
  })

  it('compara horas con segundos igual que sin ellos', () => {
    expect(
      franjasSeSuperponen(
        { dia_semana: 1, hora_inicio: '08:00:00', hora_fin: '09:00:00' },
        { dia_semana: 1, hora_inicio: '08:30', hora_fin: '09:30' },
      ),
    ).toBe(true)
  })
})

describe('buscarConflictos', () => {
  const ocupadas = [
    { materia: 'Matemática', dia_semana: 1, hora_inicio: '08:00', hora_fin: '09:00' },
  ]

  it('devuelve la materia con la que se pisa', () => {
    const conflictos = buscarConflictos(
      [{ dia_semana: 1, hora_inicio: '08:30', hora_fin: '09:30' }],
      ocupadas,
    )
    expect(conflictos).toHaveLength(1)
    expect(describirConflicto(conflictos[0])).toBe(
      'La franja 1 se superpone con Matemática (Lun 08:00–09:00).',
    )
  })

  it('detecta franjas que se pisan dentro de la misma materia', () => {
    const conflictos = buscarConflictos(
      [
        { dia_semana: 3, hora_inicio: '10:00', hora_fin: '11:00' },
        { dia_semana: 3, hora_inicio: '10:30', hora_fin: '11:30' },
      ],
      [],
    )
    expect(conflictos).toEqual([expect.objectContaining({ indice: 1, materia: null })])
  })

  it('no marca conflicto con franjas contiguas', () => {
    expect(
      buscarConflictos([{ dia_semana: 1, hora_inicio: '09:00', hora_fin: '10:00' }], ocupadas),
    ).toEqual([])
  })
})

describe('elegirPorId', () => {
  const items = [{ id: 'a' }, { id: 'b' }]

  it('devuelve el elemento pedido o el primero si no existe', () => {
    expect(elegirPorId(items, 'b')).toEqual({ id: 'b' })
    expect(elegirPorId(items, 'zzz')).toEqual({ id: 'a' })
    expect(elegirPorId(items, null)).toEqual({ id: 'a' })
    expect(elegirPorId([], 'a')).toBeUndefined()
  })
})

describe('aMinutos y deMinutos', () => {
  it('convierten entre HH:MM y minutos', () => {
    expect(aMinutos('08:30:00')).toBe(510)
    expect(deMinutos(510)).toBe('08:30')
    expect(deMinutos(420)).toBe('07:00')
  })
})

describe('calcularGrilla', () => {
  it('sin franjas muestra lunes a viernes de 07:00 a 14:00 en filas de 30 minutos', () => {
    const grilla = calcularGrilla([])
    expect(grilla.dias).toEqual([1, 2, 3, 4, 5])
    expect(grilla.inicio).toBe(7 * 60)
    expect(grilla.filas).toBe(14)
  })

  it('posiciona un bloque según día y horario', () => {
    const { bloques } = calcularGrilla([{ dia_semana: 2, hora_inicio: '08:00', hora_fin: '09:30' }])
    expect(bloques[0]).toMatchObject({ columna: 3, filaInicio: 4, filaFin: 7, superpuesto: false })
  })

  it('agrega sábado solo si hay franjas y amplía el rango horario', () => {
    const grilla = calcularGrilla([
      { dia_semana: 6, hora_inicio: '06:30:00', hora_fin: '15:15:00' },
    ])
    expect(grilla.dias).toEqual([1, 2, 3, 4, 5, 6])
    expect(grilla.inicio).toBe(6 * 60)
    expect(grilla.filas).toBe(20)
    expect(grilla.bloques[0].columna).toBe(7)
  })

  it('marca los bloques que se superponen', () => {
    const { bloques } = calcularGrilla([
      { dia_semana: 1, hora_inicio: '08:00', hora_fin: '09:00' },
      { dia_semana: 1, hora_inicio: '08:30', hora_fin: '09:30' },
      { dia_semana: 1, hora_inicio: '10:00', hora_fin: '11:00' },
    ])
    expect(bloques.map((bloque) => bloque.superpuesto)).toEqual([true, true, false])
  })
})

describe('formatearFranjaLegible', () => {
  it('separa las horas con "a" en vez de guion', () => {
    expect(
      formatearFranjaLegible({ dia_semana: 3, hora_inicio: '10:00:00', hora_fin: '11:30:00' }),
    ).toBe('Mié 10:00 a 11:30')
  })
})
