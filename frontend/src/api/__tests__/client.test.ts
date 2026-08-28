import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiClient } from '@/api/client'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

describe('apiClient', () => {
  it('devuelve undefined en una respuesta 204, sin intentar parsear JSON', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204, json: vi.fn() })

    const resultado = await apiClient('/auth/roles/algun-id')

    expect(resultado).toBeUndefined()
  })

  it('parsea el body en una respuesta 200', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: '1' }),
    })

    const resultado = await apiClient<{ id: string }>('/auth/roles')

    expect(resultado).toEqual({ id: '1' })
  })

  it('lanza ApiError con el detail del body cuando la respuesta no es ok', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ detail: 'Ya existe un rol con ese nombre' }),
    })

    await expect(apiClient('/auth/roles')).rejects.toMatchObject(
      new ApiError(409, 'Ya existe un rol con ese nombre'),
    )
  })
})
