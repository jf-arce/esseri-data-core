import { describe, expect, it } from 'vitest'
import { columnasVisibles, rangoVisible, repartirEnCarriles } from '../utils-calendario'

const intervalos = (...pares: [number, number][]) =>
  pares.map(([inicio, fin], indice) => ({ id: `a${indice}`, inicio, fin }))

describe('repartirEnCarriles', () => {
  it('leaves separate activities at full width', () => {
    const [primera, segunda] = repartirEnCarriles(intervalos([480, 540], [600, 660]))
    expect([primera.carril, primera.carriles]).toEqual([0, 1])
    expect([segunda.carril, segunda.carriles]).toEqual([0, 1])
  })

  it('does not treat touching intervals as an overlap', () => {
    const resultado = repartirEnCarriles(intervalos([480, 540], [540, 600]))
    expect(resultado.map((item) => item.carriles)).toEqual([1, 1])
  })

  it('splits a partial overlap into two parallel lanes', () => {
    const resultado = repartirEnCarriles(intervalos([480, 600], [540, 660]))
    expect(resultado.map((item) => [item.carril, item.carriles])).toEqual([
      [0, 2],
      [1, 2],
    ])
  })

  it('keeps a short class inside a long event in its own lane', () => {
    const resultado = repartirEnCarriles(intervalos([480, 720], [500, 560]))
    expect(resultado[0].carriles).toBe(2)
    expect(resultado[1].carril).toBe(1)
  })

  it('assigns three or more simultaneous activities to distinct lanes', () => {
    const resultado = repartirEnCarriles(intervalos([480, 540], [480, 540], [480, 540], [480, 540]))
    expect(resultado.map((item) => item.carril)).toEqual([0, 1, 2, 3])
    expect(resultado.every((item) => item.carriles === 4)).toBe(true)
    expect(resultado.every((item) => item.grupo === 0)).toBe(true)
    expect(resultado.every((item) => item.grupoInicio === 480 && item.grupoFin === 540)).toBe(true)
    expect(columnasVisibles(4)).toBe(3)
  })

  it('keeps separate overlap groups apart', () => {
    const resultado = repartirEnCarriles(intervalos([480, 600], [540, 660], [900, 960]))
    expect(resultado.map((item) => item.grupo)).toEqual([0, 0, 1])
    expect(resultado[2].carril).toBe(0)
    expect(resultado[2].carriles).toBe(1)
  })

  it('reuses a lane once the earlier activity ends', () => {
    const resultado = repartirEnCarriles(intervalos([480, 540], [480, 600], [540, 620]))
    expect(resultado.map((item) => item.carril)).toEqual([1, 0, 1])
    expect(resultado.map((item) => item.carriles)).toEqual([2, 2, 2])
  })
})

describe('rangoVisible', () => {
  it('keeps the school day when everything fits inside it', () => {
    expect(rangoVisible(450, 990, intervalos([480, 540]))).toEqual({ inicio: 450, fin: 990 })
  })

  it('expands to an event before school hours', () => {
    expect(rangoVisible(450, 990, intervalos([360, 420]))).toEqual({ inicio: 360, fin: 990 })
  })

  it('expands to an evening event and rounds to the grid step', () => {
    expect(rangoVisible(450, 990, intervalos([1080, 1145]))).toEqual({ inicio: 450, fin: 1170 })
  })

  it('never exceeds a full day', () => {
    expect(rangoVisible(450, 990, intervalos([-30, 1500]))).toEqual({ inicio: 0, fin: 1440 })
  })

  it('rounds an event that does not fall on a grid boundary', () => {
    expect(rangoVisible(450, 990, intervalos([430, 455]))).toEqual({ inicio: 420, fin: 990 })
  })
})
