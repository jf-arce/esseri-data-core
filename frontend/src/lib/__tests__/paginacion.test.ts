import { describe, expect, it } from 'vitest'
import { paginasVisibles } from '@/lib/paginacion'

describe('paginacion', () => {
  it('acota las páginas visibles sin ocultar los extremos', () => {
    expect(paginasVisibles(3, 2)).toEqual([1, 2, 3])
    expect(paginasVisibles(10, 5)).toEqual([1, 'elipsis', 4, 5, 6, 'elipsis', 10])
    expect(paginasVisibles(10, 10)).toEqual([1, 'elipsis', 7, 8, 9, 10])
  })
})
