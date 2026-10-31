import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import { descargarAdjunto, nombreArchivoSeguro, rutaArchivoAdjunto } from '../descargar-adjunto'
import type { Adjunto } from '../../types'

const adjunto: Adjunto = {
  id: 'a1',
  nombre: 'acta.pdf',
  tipo_contenido: 'application/pdf',
  tamanio: 2048,
  estado: 'limpio',
}

const crearObjectURL = vi.fn(() => 'blob:adjunto')
const revocarObjectURL = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  Object.defineProperty(URL, 'createObjectURL', { writable: true, value: crearObjectURL })
  Object.defineProperty(URL, 'revokeObjectURL', { writable: true, value: revocarObjectURL })
  crearObjectURL.mockClear()
  revocarObjectURL.mockClear()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('descargarAdjunto', () => {
  it('requests the file with the JWT cookie and sanitizes the filename', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('contenido', { status: 200 }))
    await descargarAdjunto('c1', { ...adjunto, nombre: '../../etc/passwd.pdf' })

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toContain('/comunicaciones/c1/adjuntos/a1/archivo')
    expect(init).toEqual(expect.objectContaining({ credentials: 'include' }))
    expect(crearObjectURL).toHaveBeenCalledTimes(1)
    expect(revocarObjectURL).toHaveBeenCalledWith('blob:adjunto')
  })

  it('uses the family download route for responsible users', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('contenido', { status: 200 }))
    await descargarAdjunto('c1', adjunto, { familia: true })
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain(
      '/comunicaciones/familia/c1/adjuntos/a1/archivo',
    )
  })

  it('throws an ApiError and does not create a blob when the server denies the download', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 403 }))
    await expect(descargarAdjunto('c1', adjunto)).rejects.toBeInstanceOf(ApiError)
    expect(crearObjectURL).not.toHaveBeenCalled()
  })

  it('keeps only the base filename', () => {
    expect(nombreArchivoSeguro('../../etc/passwd.pdf')).toBe('etcpasswd.pdf')
    expect(nombreArchivoSeguro('')).toBe('adjunto')
    expect(nombreArchivoSeguro('acta.pdf')).toBe('acta.pdf')
    expect(rutaArchivoAdjunto('c1', 'a1', { docente: true })).toBe(
      '/comunicaciones/docente/c1/adjuntos/a1/archivo',
    )
  })
})
