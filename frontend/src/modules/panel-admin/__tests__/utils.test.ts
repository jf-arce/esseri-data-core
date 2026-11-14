import { expect, it } from 'vitest'
import {
  antiguedad,
  diasDesde,
  fechaActividad,
  porcentajeCobranza,
  variacionPorcentual,
} from '../utils'

it('formats activity dates in the user timezone with Hoy and Ayer', () => {
  const ahora = new Date('2026-10-20T18:00:00.000Z')
  // es-AR rinde la hora en 12 h con "p. m."; el instante exacto depende de la zona del runner.
  const hora = / · \d{2}:\d{2}\s?[ap]\.\s?m\.$/
  expect(fechaActividad('2026-10-20T15:30:00.000Z', ahora)).toMatch(/^Hoy/)
  expect(fechaActividad('2026-10-19T15:30:00.000Z', ahora)).toMatch(/^Ayer/)
  expect(fechaActividad('2026-10-01T15:30:00.000Z', ahora)).toMatch(/^01\/10\/2026/)
  expect(fechaActividad('2025-10-01T15:30:00.000Z', ahora)).toMatch(/^01\/10\/2025/)
  for (const valor of [
    '2026-10-20T15:30:00.000Z',
    '2026-10-19T15:30:00.000Z',
    '2026-10-01T15:30:00.000Z',
    '2025-10-01T15:30:00.000Z',
  ]) {
    expect(fechaActividad(valor, ahora)).toMatch(hora)
  }
})

it('computes age in whole calendar days and never goes negative', () => {
  const ahora = new Date(2026, 10, 13, 9, 0)
  expect(diasDesde('2026-11-13', ahora)).toBe(0)
  expect(diasDesde('2026-11-01', ahora)).toBe(12)
  expect(diasDesde('2026-12-01', ahora)).toBe(0)
  expect(antiguedad(0)).toBe('hoy')
  expect(antiguedad(1)).toBe('hace 1 día')
  expect(antiguedad(12)).toBe('hace 12 días')
})

it('returns null instead of invalid percentages when the base is zero', () => {
  expect(porcentajeCobranza(200, 150)).toBe(75)
  expect(porcentajeCobranza(0, 50)).toBeNull()
  expect(variacionPorcentual(150, 100)).toBe(50)
  expect(variacionPorcentual(50, 100)).toBe(-50)
  expect(variacionPorcentual(50, 0)).toBeNull()
})
