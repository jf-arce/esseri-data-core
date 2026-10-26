import { describe, expect, it } from 'vitest'

import { formatearDiaDeInstante, formatearFechaHora } from '@/lib/fechas'

describe('formatearFechaHora', () => {
  it('muestra un instante UTC en la zona de Argentina, en 24 h', () => {
    expect(formatearFechaHora('2027-03-01T02:30:00Z')).toBe('28/02/2027, 23:30')
  })

  it('acepta el offset +00:00 que devuelve el backend', () => {
    expect(formatearFechaHora('2027-03-01T02:30:00+00:00')).toBe('28/02/2027, 23:30')
  })

  it('respeta un offset explícito', () => {
    expect(formatearFechaHora('2027-03-01T00:30:00-03:00')).toBe('01/03/2027, 00:30')
  })

  it('acepta microsegundos', () => {
    expect(formatearFechaHora('2027-03-01T02:30:00.123456Z')).toBe('28/02/2027, 23:30')
  })

  it('muestra 00:xx y no 24:xx a medianoche', () => {
    expect(formatearFechaHora('2027-03-01T03:05:00Z')).toBe('01/03/2027, 00:05')
  })

  it('devuelve un guion si falta o es inválido', () => {
    expect(formatearFechaHora(null)).toBe('—')
    expect(formatearFechaHora('')).toBe('—')
    expect(formatearFechaHora('no es una fecha')).toBe('—')
  })
})

describe('formatearDiaDeInstante', () => {
  it('muestra el día en la zona de Argentina, no el de UTC', () => {
    expect(formatearDiaDeInstante('2027-03-01T02:30:00Z')).toBe('28/02/2027')
  })

  it('acepta offset y microsegundos', () => {
    expect(formatearDiaDeInstante('2027-03-01T00:30:00.5-03:00')).toBe('01/03/2027')
  })

  it('devuelve un guion si es inválido', () => {
    expect(formatearDiaDeInstante('no es una fecha')).toBe('—')
  })
})
