import { expect, it } from 'vitest'
import { fechaActividad } from '../utils'

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
