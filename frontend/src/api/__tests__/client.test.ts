import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiClient, onSesionExpirada } from '@/api/client'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  onSesionExpirada(null)
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

const ok = (cuerpo: unknown = {}) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(cuerpo),
})
const noAutorizado = { ok: false, status: 401, json: () => Promise.resolve({ detail: 'x' }) }

describe('renovación de sesión', () => {
  it('ante un 401 renueva con /auth/refresh y reintenta una vez', async () => {
    fetchMock
      .mockResolvedValueOnce(noAutorizado)
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(ok({ id: '1' }))

    const resultado = await apiClient<{ id: string }>('/auth/roles')

    expect(resultado).toEqual({ id: '1' })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(String(fetchMock.mock.calls[1][0])).toContain('/auth/refresh')
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'POST' })
  })

  it('con dos 401 simultáneos hace un solo refresh', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/auth/refresh')) return Promise.resolve(ok())
      const reintento = fetchMock.mock.calls.filter(([u]) => u === url).length > 1
      return Promise.resolve(reintento ? ok({ id: url }) : noAutorizado)
    })

    await Promise.all([apiClient('/a'), apiClient('/b')])

    const refreshes = fetchMock.mock.calls.filter(([url]) => String(url).includes('/auth/refresh'))
    expect(refreshes).toHaveLength(1)
  })

  it('si el refresh falla con 401 avisa que la sesión expiró y devuelve el 401', async () => {
    const alExpirar = vi.fn()
    onSesionExpirada(alExpirar)
    fetchMock.mockResolvedValue(noAutorizado)

    await expect(apiClient('/auth/me')).rejects.toMatchObject({ status: 401 })

    expect(alExpirar).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('no renueva ante un 401 de /auth/login', async () => {
    fetchMock.mockResolvedValue(noAutorizado)

    await expect(apiClient('/auth/login', { method: 'POST' })).rejects.toMatchObject({
      status: 401,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
