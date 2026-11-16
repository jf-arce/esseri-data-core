import { beforeEach, describe, expect, it } from 'vitest'
import {
  borrarRespaldo,
  claveRespaldo,
  guardarRespaldo,
  leerRespaldo,
} from '@/modules/workflows/services/respaldo-regla'
import { nuevoNodoAccion, BORRADOR_VACIO } from '@/modules/workflows/utils-grafo'

const clave = claveRespaldo('u1', 'r-1')

beforeEach(() => window.localStorage.clear())

describe('respaldo-regla', () => {
  it('guarda, lee y borra el borrador', () => {
    const borrador = {
      ...BORRADOR_VACIO,
      nombre: 'Aviso de mora',
      nodos: [nuevoNodoAccion(null, null, null)],
    }
    guardarRespaldo(clave, borrador, '2026-01-01T00:00:00Z')

    const leido = leerRespaldo(clave)
    expect(leido?.borrador).toEqual(borrador)
    expect(leido?.base).toBe('2026-01-01T00:00:00Z')

    borrarRespaldo(clave)
    expect(leerRespaldo(clave)).toBeNull()
  })

  it('rechaza JSON inválido', () => {
    window.localStorage.setItem(clave, '{no es json')
    expect(leerRespaldo(clave)).toBeNull()
  })

  it('rechaza un respaldo con forma vieja', () => {
    window.localStorage.setItem(
      clave,
      JSON.stringify({ borrador: { nombre: 'x' }, base: null, actualizado: 1 }),
    )
    expect(leerRespaldo(clave)).toBeNull()
  })

  it('separa los respaldos por usuario y por regla', () => {
    guardarRespaldo(clave, BORRADOR_VACIO, null)
    expect(leerRespaldo(claveRespaldo('u2', 'r-1'))).toBeNull()
    expect(leerRespaldo(claveRespaldo('u1', 'nueva'))).toBeNull()
  })
})
