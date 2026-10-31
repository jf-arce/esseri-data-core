import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AdjuntosComunicacion } from '../adjuntos-comunicacion'
import type { Adjunto } from '../../types'

const adjunto: Adjunto = {
  id: 'a1',
  nombre: 'imagen.png',
  tipo_contenido: 'image/png',
  tamanio: 123,
  estado: 'limpio',
}
const crearUrl = vi.fn(() => 'blob:archivo-privado')
const revocarUrl = vi.fn()

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
    configurable: true,
    value: () => false,
  })
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: () => {},
  })
  Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
    configurable: true,
    value: () => {},
  })
  vi.stubGlobal('fetch', vi.fn())
  Object.defineProperty(URL, 'createObjectURL', { writable: true, value: crearUrl })
  Object.defineProperty(URL, 'revokeObjectURL', { writable: true, value: revocarUrl })
  crearUrl.mockClear()
  revocarUrl.mockClear()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it.each([
  [{ familia: true }, '/comunicaciones/familia/'],
  [{ docente: true }, '/comunicaciones/docente/'],
  [{}, '/comunicaciones/c1/'],
])('previews an image with authorized access and cleans up on close (%j)', async (props, ruta) => {
  vi.mocked(fetch).mockResolvedValue(
    new Response('image', { headers: { 'Content-Type': 'image/png' } }),
  )
  render(<AdjuntosComunicacion comunicacionId="c1" adjuntos={[adjunto]} {...props} />)
  const ver = screen.getByRole('button', { name: 'Ver adjunto' })
  await userEvent.click(ver)
  expect(await screen.findByRole('img', { name: 'Vista previa de imagen.png' })).toHaveAttribute(
    'src',
    'blob:archivo-privado',
  )
  const [url, init] = vi.mocked(fetch).mock.calls[0]
  expect(String(url)).toContain(ruta)
  expect(init).toMatchObject({ credentials: 'include', cache: 'no-store' })
  expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
  await waitFor(() => expect(revocarUrl).toHaveBeenCalledWith('blob:archivo-privado'))
  expect(init?.signal?.aborted).toBe(true)
  expect(ver).toHaveFocus()
})

it('shows PDFs inside the dialog and keeps downloading optional', async () => {
  vi.mocked(fetch).mockImplementation(
    async () => new Response('pdf', { headers: { 'Content-Type': 'application/pdf' } }),
  )
  render(
    <AdjuntosComunicacion
      comunicacionId="c1"
      adjuntos={[{ ...adjunto, nombre: 'acta.pdf', tipo_contenido: 'application/pdf' }]}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Ver adjunto' }))
  expect((await screen.findByTitle('Vista previa de acta.pdf')).getAttribute('src')).toContain(
    'blob:archivo-privado',
  )
  expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Descargar' }))
  await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1))
})

it('uses one plural entry action and switches between files inside the viewer', async () => {
  vi.mocked(fetch).mockImplementation(
    async () => new Response('image', { headers: { 'Content-Type': 'image/png' } }),
  )
  render(
    <AdjuntosComunicacion
      comunicacionId="c1"
      adjuntos={[adjunto, { ...adjunto, id: 'a2', nombre: 'otra.png' }]}
      familia
    />,
  )
  expect(screen.queryByRole('button', { name: /Descargar/ })).not.toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'Ver adjuntos' })).toHaveLength(1)
  await userEvent.click(screen.getByRole('button', { name: 'Ver adjuntos' }))
  await screen.findByRole('img', { name: 'Vista previa de imagen.png' })
  await userEvent.click(screen.getByRole('combobox', { name: 'Elegir adjunto' }))
  await userEvent.click(await screen.findByRole('option', { name: 'otra.png' }))
  expect(await screen.findByRole('img', { name: 'Vista previa de otra.png' })).toBeInTheDocument()
  expect(String(vi.mocked(fetch).mock.calls[1][0])).toContain('/adjuntos/a2/archivo')
  expect(revocarUrl).toHaveBeenCalled()
})

it('shows denied access without a preview and permits retry', async () => {
  vi.mocked(fetch)
    .mockResolvedValueOnce(new Response('', { status: 403 }))
    .mockResolvedValueOnce(new Response('image', { headers: { 'Content-Type': 'image/png' } }))
  render(<AdjuntosComunicacion comunicacionId="c1" adjuntos={[adjunto]} familia />)
  await userEvent.click(screen.getByRole('button', { name: 'Ver adjunto' }))
  expect(
    await screen.findByText('No se pudo abrir el archivo. Volvé a intentarlo.'),
  ).toBeInTheDocument()
  expect(crearUrl).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByRole('img')).toBeInTheDocument()
})

it('never embeds an unexpected HTML response', async () => {
  vi.mocked(fetch).mockResolvedValue(
    new Response('<script>alert(1)</script>', { headers: { 'Content-Type': 'text/html' } }),
  )
  render(<AdjuntosComunicacion comunicacionId="c1" adjuntos={[adjunto]} />)
  await userEvent.click(screen.getByRole('button', { name: 'Ver adjunto' }))
  expect(
    await screen.findByText('No se pudo abrir el archivo. Volvé a intentarlo.'),
  ).toBeInTheDocument()
  expect(crearUrl).not.toHaveBeenCalled()
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
})

it('cancels a pending preview and ignores a late response', async () => {
  let resolver!: (response: Response) => void
  vi.mocked(fetch).mockReturnValue(
    new Promise((resolve) => {
      resolver = resolve
    }),
  )
  render(<AdjuntosComunicacion comunicacionId="c1" adjuntos={[adjunto]} />)
  await userEvent.click(screen.getByRole('button', { name: 'Ver adjunto' }))
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
  expect(vi.mocked(fetch).mock.calls[0][1]?.signal?.aborted).toBe(true)
  await act(async () => {
    resolver(new Response('image', { headers: { 'Content-Type': 'image/png' } }))
  })
  expect(crearUrl).not.toHaveBeenCalled()
})

it('shows file format metadata without a clean verification badge', async () => {
  vi.mocked(fetch).mockResolvedValue(
    new Response('image', { headers: { 'Content-Type': 'image/png' } }),
  )
  render(<AdjuntosComunicacion comunicacionId="c1" adjuntos={[adjunto]} />)
  expect(screen.getByText('imagen.png')).toBeInTheDocument()
  expect(screen.getByText(/^PNG ·/)).toBeInTheDocument()
  expect(screen.queryByText('Verificado')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Ver adjunto' }))
  await screen.findByRole('img', { name: 'Vista previa de imagen.png' })
  expect(screen.getByLabelText('Nivel de zoom')).toHaveTextContent('100%')
  await userEvent.click(screen.getByRole('button', { name: 'Aumentar zoom' }))
  expect(screen.getByLabelText('Nivel de zoom')).toHaveTextContent('125%')
  await userEvent.click(screen.getByRole('button', { name: 'Reducir zoom' }))
  expect(screen.getByLabelText('Nivel de zoom')).toHaveTextContent('100%')
})

it('does not allow previewing quarantined files', () => {
  const { rerender } = render(
    <AdjuntosComunicacion comunicacionId="c1" adjuntos={[{ ...adjunto, estado: 'cuarentena' }]} />,
  )
  expect(screen.getByRole('button', { name: 'Ver adjunto' })).toBeDisabled()
  rerender(
    <AdjuntosComunicacion
      comunicacionId="c1"
      adjuntos={[{ ...adjunto, estado: 'cuarentena' }]}
      familia
    />,
  )
  expect(screen.queryByRole('button', { name: 'Ver adjunto' })).not.toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalled()
})
