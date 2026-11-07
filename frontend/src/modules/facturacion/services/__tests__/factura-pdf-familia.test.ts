import { afterEach, expect, it, vi } from 'vitest'
import { compartirFacturaFamilia, descargarFacturaFamilia } from '../factura-pdf-familia'
import { descargarExport } from '@/lib/descargar-export'

vi.mock('@/lib/descargar-export')
afterEach(() => vi.unstubAllGlobals())

it('downloads the selected invoice through the family endpoint', async () => {
  await descargarFacturaFamilia('abc')
  expect(descargarExport).toHaveBeenCalledWith(
    '/facturacion/familia/me/facturas/abc/pdf',
    'factura-abc.pdf',
  )
})

it('shares the selected PDF file without exposing a link', async () => {
  const share = vi.fn().mockResolvedValue(undefined)
  const canShare = vi.fn().mockReturnValue(true)
  const fetch = vi.fn().mockResolvedValue({
    ok: true,
    blob: async () => new Blob(['pdf'], { type: 'application/pdf' }),
  })
  vi.stubGlobal('fetch', fetch)
  vi.stubGlobal('navigator', { share, canShare })
  await compartirFacturaFamilia('abc')
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/facturacion/familia/me/facturas/abc/pdf'),
    { credentials: 'include' },
  )
  expect(share).toHaveBeenCalledWith(expect.objectContaining({ files: [expect.any(File)] }))
  expect(share.mock.calls[0][0].files[0].name).toBe('factura-abc.pdf')
  expect(share.mock.calls[0][0]).not.toHaveProperty('url')
})
