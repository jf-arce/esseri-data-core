import { describe, expect, it } from 'vitest'
import { ordenarFilas, siguienteOrden, formatearCelda, esColumnaDeCambio } from '../tablas'

describe('formatearCelda', () => {
  it('distingue "sin registros" de 0 %', () => {
    expect(formatearCelda(null, 'porcentaje')).toBe('Sin registros')
    expect(formatearCelda(0, 'porcentaje')).toBe('0 %')
  })

  it('formatea importes en pesos', () => {
    expect(formatearCelda(1500, 'moneda')).toContain('1.500')
  })
})

describe('orden de tablas', () => {
  const filas = [
    { nombre: 'b', monto: 10, alumno: '[ALUMNO:1]' },
    { nombre: 'a', monto: null, alumno: '[ALUMNO:2]' },
    { nombre: 'C', monto: 9, alumno: '[ALUMNO:3]' },
  ]

  it('rota asc, desc y sin orden', () => {
    const asc = siguienteOrden(null, 'monto')
    expect(asc).toEqual({ clave: 'monto', dir: 'asc' })
    expect(siguienteOrden(asc, 'monto')).toEqual({ clave: 'monto', dir: 'desc' })
    expect(siguienteOrden({ clave: 'monto', dir: 'desc' }, 'monto')).toBeNull()
    expect(siguienteOrden(asc, 'nombre')).toEqual({ clave: 'nombre', dir: 'asc' })
  })

  it('ordena los números como números y deja los vacíos al final', () => {
    const col = { clave: 'monto', etiqueta: 'Monto', tipo: 'moneda' } as const
    expect(ordenarFilas(filas, col, 'asc', {}).map((f) => f.monto)).toEqual([9, 10, null])
    expect(ordenarFilas(filas, col, 'desc', {}).map((f) => f.monto)).toEqual([10, 9, null])
  })

  it('ordena el texto sin distinguir mayúsculas y no muta la entrada', () => {
    const col = { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto' } as const
    expect(ordenarFilas(filas, col, 'asc', {}).map((f) => f.nombre)).toEqual(['a', 'b', 'C'])
    expect(filas.map((f) => f.nombre)).toEqual(['b', 'a', 'C'])
  })

  it('ordena los alias por el nombre resuelto', () => {
    const col = { clave: 'alumno', etiqueta: 'Alumno', tipo: 'alias' } as const
    const porAlias = {
      '[ALUMNO:1]': { alias: '[ALUMNO:1]', tipo: 'ALUMNO', entidad_id: 'x', nombre: 'Zeta, Ana' },
      '[ALUMNO:2]': { alias: '[ALUMNO:2]', tipo: 'ALUMNO', entidad_id: 'y', nombre: 'Alba, Eva' },
    } as const
    expect(ordenarFilas(filas.slice(0, 2), col, 'asc', porAlias).map((f) => f.alumno)).toEqual([
      '[ALUMNO:2]',
      '[ALUMNO:1]',
    ])
  })
})

describe('esColumnaDeCambio', () => {
  it('reconoce las columnas de variación y diferencia', () => {
    const columna = (clave: string) => ({ clave, etiqueta: clave, tipo: 'numero' as const })
    expect(esColumnaDeCambio(columna('variacion_facturado'))).toBe(true)
    expect(esColumnaDeCambio(columna('diferencia_presencia'))).toBe(true)
    expect(esColumnaDeCambio(columna('facturado'))).toBe(false)
  })
})
