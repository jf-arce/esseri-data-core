import { describe, expect, it } from 'vitest'
import { tonoDeKpi, iconoDeKpi } from '../kpi'

describe('tonoDeKpi', () => {
  const kpi = { tipo: 'kpi', titulo: 'x', valor: 1, unidad: '', periodo: 'p', fuente: 'f' } as const

  it('es bueno si la variación va hacia donde es mejor', () => {
    expect(tonoDeKpi({ ...kpi, variacion: 5, mejora: 'alza' })).toBe('bueno')
    expect(tonoDeKpi({ ...kpi, variacion: -5, mejora: 'baja' })).toBe('bueno')
  })

  it('es malo si va al revés', () => {
    expect(tonoDeKpi({ ...kpi, variacion: -5, mejora: 'alza' })).toBe('malo')
    expect(tonoDeKpi({ ...kpi, variacion: 5, mejora: 'baja' })).toBe('malo')
  })

  it('es neutro sin variación, sin cambio o sin saber qué es mejor', () => {
    expect(tonoDeKpi({ ...kpi, mejora: 'alza' })).toBe('neutro')
    expect(tonoDeKpi({ ...kpi, variacion: null, mejora: 'alza' })).toBe('neutro')
    expect(tonoDeKpi({ ...kpi, variacion: 0, mejora: 'alza' })).toBe('neutro')
    expect(tonoDeKpi({ ...kpi, variacion: 5 })).toBe('neutro')
  })
})

describe('iconoDeKpi', () => {
  const kpi = { tipo: 'kpi', titulo: 'x', valor: 1, unidad: '', periodo: 'p', fuente: 'f' } as const

  it('elige el ícono según de qué trata el indicador', () => {
    expect(iconoDeKpi({ ...kpi, titulo: 'Ausentes (total)' })).toBe('ausentes')
    expect(iconoDeKpi({ ...kpi, titulo: 'Inasistencias del día' })).toBe('ausentes')
    expect(iconoDeKpi({ ...kpi, titulo: 'Inscripciones (total)' })).toBe('inscripciones')
    expect(iconoDeKpi({ ...kpi, titulo: 'Alumnos activos' })).toBe('alumnos')
    expect(iconoDeKpi({ ...kpi, titulo: 'Tareas abiertas (todas)' })).toBe('tareas')
    expect(iconoDeKpi({ ...kpi, titulo: 'Solicitudes de compra pendientes' })).toBe('compras')
  })

  it('distingue la deuda del resto de los importes', () => {
    expect(iconoDeKpi({ ...kpi, titulo: 'Deuda vencida total', unidad: '$' })).toBe('deuda')
    expect(iconoDeKpi({ ...kpi, titulo: 'Facturado (total)', unidad: '$' })).toBe('dinero')
  })

  it('usa un ícono general si no reconoce el tema', () => {
    expect(iconoDeKpi({ ...kpi, titulo: 'Algo nuevo' })).toBe('general')
  })
})
