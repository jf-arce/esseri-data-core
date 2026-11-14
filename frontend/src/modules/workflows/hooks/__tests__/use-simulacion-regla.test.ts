import { describe, expect, it } from 'vitest'
import { borradorDesdeRegla } from '@/modules/workflows/utils-grafo'
import { nodoAccion, nodoCondicion, reglaDe } from '@/modules/workflows/__tests__/fabricas'
import { ordenDeRecorrido } from '@/modules/workflows/hooks/use-simulacion-regla'

describe('ordenDeRecorrido', () => {
  const borrador = borradorDesdeRegla(
    reglaDe({
      nodos: [
        nodoCondicion('c-1'),
        nodoAccion('a-si', { padre_id: 'c-1', rama: 'si' }),
        nodoAccion('a-no', { padre_id: 'c-1', rama: 'no' }),
        nodoAccion('a-directa'),
      ],
    }),
  )

  it('recorre desde el disparador, primero lo que cuelga de él y la salida Sí antes que la No', () => {
    const estados = new Map([
      ['c-1', 'cumple'],
      ['a-si', 'alcanzada'],
      ['a-no', 'no_alcanzado'],
      ['a-directa', 'alcanzada'],
    ])

    expect(ordenDeRecorrido(borrador, estados)).toEqual(['c-1', 'a-si', 'a-directa'])
  })

  it('si la condición no se cumple sigue por la rama No', () => {
    const estados = new Map([
      ['c-1', 'no_cumple'],
      ['a-si', 'no_alcanzado'],
      ['a-no', 'alcanzada'],
      ['a-directa', 'alcanzada'],
    ])

    expect(ordenDeRecorrido(borrador, estados)).toEqual(['c-1', 'a-no', 'a-directa'])
  })
})
