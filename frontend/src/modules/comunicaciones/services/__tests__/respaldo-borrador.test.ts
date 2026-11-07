import { beforeEach, expect, it, vi } from 'vitest'
import { guardarRespaldo, leerRespaldos } from '../respaldo-borrador'

const datos = {
  clave: 'draft-one',
  asunto: 'Incomplete subject',
  cuerpo: '',
  audiencia: { tipo: 'division' as const, ids: [] },
}

beforeEach(() => {
  const values = new Map<string, string>()
  const storage: Storage = {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  }
  vi.stubGlobal('localStorage', storage)
})

it('persists immediately and isolates drafts by user and identity', () => {
  guardarRespaldo('user-a', false, datos)
  guardarRespaldo('user-a', false, { ...datos, clave: 'draft-two', asunto: 'Second' })
  expect(
    leerRespaldos('user-a', false)
      .map((item) => item.datos.clave)
      .sort(),
  ).toEqual(['draft-one', 'draft-two'])
  expect(leerRespaldos('user-b', false)).toEqual([])
})

it('reports storage errors rather than claiming success', () => {
  const failure = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
    throw new DOMException('Full', 'QuotaExceededError')
  })
  expect(() => guardarRespaldo('user-a', false, datos)).toThrow()
  failure.mockRestore()
})

it('keeps independent local copies of the same server draft', () => {
  guardarRespaldo('user-a', false, datos, { localId: 'tab-one', id: 'remote', version: 1 })
  guardarRespaldo(
    'user-a',
    false,
    { ...datos, asunto: 'Other edit' },
    {
      localId: 'tab-two',
      id: 'remote',
      version: 1,
    },
  )
  const respaldos = leerRespaldos('user-a', false)
  expect(respaldos).toHaveLength(2)
  expect(respaldos.map((item) => item.datos.asunto).sort()).toEqual([
    'Incomplete subject',
    'Other edit',
  ])
})

it('expires a synchronized cache but never an unsynchronized copy', () => {
  const old = Date.now() - 48 * 60 * 60 * 1000
  const original = vi.spyOn(Date, 'now').mockReturnValue(old)
  guardarRespaldo('user-a', false, datos, { localId: 'cache', id: 'remoto', pendiente: false })
  guardarRespaldo(
    'user-a',
    false,
    { ...datos, clave: 'sin-sincronizar' },
    {
      localId: 'pendiente',
      pendiente: true,
    },
  )
  original.mockRestore()

  expect(leerRespaldos('user-a', false).map((item) => item.localId)).toEqual(['pendiente'])
  expect(window.localStorage.length).toBe(1)
})
