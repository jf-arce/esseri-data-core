import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import { ComunicacionFormPage } from '../comunicacion-form-page'
import { ComunicacionDetallePage } from '../comunicacion-detalle-page'
import { ComunicacionesPage } from '../comunicaciones-page'

vi.mock('@/api/client')
const api = vi.mocked(apiClient)
const comunicacion = {
  id: 'c1',
  clave: 'key1',
  asunto: 'Reunión',
  cuerpo: '<script>secreto</script>',
  tipo: 'institucional',
  emisor: 'Colegio ESSERI',
  estado: 'borrador',
  audiencia: { tipo: 'todos', ids: [] },
  destinatarios: 0,
  created_at: '2026-10-29T12:00:00',
  publicada_at: null,
  leida_at: null,
}

beforeEach(() => {
  vi.resetAllMocks()
  api.mockImplementation(async (path) => {
    if (path.includes('/opciones'))
      return { responsables: [], alumnos: [], niveles: [], divisiones: [], ciclos: [] }
    if (path.includes('/vista-previa')) return { destinatarios: 2 }
    if (path.includes('/publicar'))
      return { ...comunicacion, estado: 'publicada', destinatarios: 2 }
    if (path.includes('/lectura')) return { ...comunicacion, leida_at: '2026-10-29T12:01:00' }
    if (path.includes('?')) return { items: [comunicacion], total: 1, pagina: 1, total_paginas: 1 }
    return comunicacion
  })
})

it('saves a basic draft without publishing', async () => {
  render(
    <MemoryRouter>
      <ComunicacionFormPage />
    </MemoryRouter>,
  )
  await userEvent.type(screen.getByLabelText('Asunto'), 'Reunión')
  await userEvent.type(screen.getByLabelText('Mensaje'), 'Información institucional')
  await userEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Borrador guardado')
  expect(api.mock.calls.some(([path]) => path.includes('/publicar'))).toBe(false)
})

it('previews recipients and publishes once with a persisted draft ID', async () => {
  render(
    <MemoryRouter>
      <ComunicacionFormPage />
    </MemoryRouter>,
  )
  await userEvent.type(screen.getByLabelText('Asunto'), 'Reunión')
  await userEvent.type(screen.getByLabelText('Mensaje'), 'Contenido')
  await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
  await screen.findByText('Todos los responsables habilitados')
  await userEvent.click(screen.getByRole('button', { name: 'Vista previa' }))
  expect(await screen.findByText('Institucional · 2 responsables')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Publicar' }))
  expect(await screen.findByRole('heading', { name: 'Comunicación publicada' })).toBeInTheDocument()
  expect(api.mock.calls.filter(([path]) => path === '/comunicaciones/c1/publicar')).toHaveLength(1)
})

it('records reading only after the detail is available and renders content as text', async () => {
  render(
    <MemoryRouter initialEntries={['/familia/comunicaciones/c1']}>
      <Routes>
        <Route path="/familia/comunicaciones/:id" element={<ComunicacionDetallePage familia />} />
      </Routes>
    </MemoryRouter>,
  )
  expect(await screen.findByText('<script>secreto</script>')).toBeInTheDocument()
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      '/comunicaciones/familia/c1/lectura',
      expect.objectContaining({ method: 'PUT' }),
    ),
  )
  expect(document.querySelector('script')).toBeNull()
})

it('keeps the detail usable and offers retry when reading could not be recorded', async () => {
  api.mockImplementation(async (path) => {
    if (path.includes('/lectura')) throw new Error('Sin conexión')
    return comunicacion
  })
  render(
    <MemoryRouter initialEntries={['/familia/comunicaciones/c1']}>
      <Routes>
        <Route path="/familia/comunicaciones/:id" element={<ComunicacionDetallePage familia />} />
      </Routes>
    </MemoryRouter>,
  )
  expect(await screen.findByText('No se pudo registrar la lectura.')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Reunión' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reintentar lectura' })).toBeInTheDocument()
})

it('family inbox shows individual unread status without management actions', async () => {
  render(
    <MemoryRouter>
      <ComunicacionesPage familia />
    </MemoryRouter>,
  )
  expect(await screen.findByText('No leída')).toBeInTheDocument()
  expect(screen.getByText('Institucional')).toBeInTheDocument()
  expect(screen.queryByText('Colegio ESSERI')).toBeNull()
  expect(screen.queryByRole('link', { name: 'Nueva comunicación' })).toBeNull()
})

it('family inbox identifies the teacher for course communications', async () => {
  api.mockResolvedValue({
    items: [{ ...comunicacion, tipo: 'curso', emisor: 'Laura Díaz' }],
    total: 1,
    pagina: 1,
    total_paginas: 1,
  })
  render(
    <MemoryRouter>
      <ComunicacionesPage familia />
    </MemoryRouter>,
  )
  expect(await screen.findByText('Laura Díaz')).toBeInTheDocument()
  expect(screen.queryByText('Institucional')).toBeNull()
})

it('teacher form only offers assigned courses and publishes through teacher endpoints', async () => {
  api.mockImplementation(async (path) => {
    if (path.includes('/docente/opciones'))
      return {
        responsables: [],
        alumnos: [{ id: 'a1', nombre: 'Alumno Uno' }],
        niveles: [],
        divisiones: [{ id: 'd1', nombre: '4° B' }],
        ciclos: ['2026'],
      }
    if (path.includes('/docente/vista-previa')) return { destinatarios: 1 }
    if (path.includes('/docente/c1/publicar'))
      return { ...comunicacion, tipo: 'curso', estado: 'publicada', destinatarios: 1 }
    if (path === '/comunicaciones/docente') return { ...comunicacion, tipo: 'curso' }
    return comunicacion
  })
  render(
    <MemoryRouter>
      <ComunicacionFormPage docente />
    </MemoryRouter>,
  )
  await userEvent.type(screen.getByLabelText('Asunto'), 'Materiales')
  await userEvent.type(screen.getByLabelText('Mensaje'), 'Traer una botella')
  await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
  expect(screen.queryByText('Todos los responsables habilitados')).toBeNull()
  await userEvent.click(await screen.findByLabelText('4° B'))
  await userEvent.click(screen.getByRole('button', { name: 'Vista previa' }))
  expect(await screen.findByText('Comunicación de curso · 1 responsables')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Publicar' }))
  expect(await screen.findByRole('heading', { name: 'Comunicación publicada' })).toBeInTheDocument()
  expect(api.mock.calls.some(([path]) => path === '/comunicaciones/docente')).toBe(true)
  expect(api.mock.calls.some(([path]) => path === '/comunicaciones/docente/c1/publicar')).toBe(true)
})

it('teacher history asks the teacher endpoint and hides management creation for family', async () => {
  api.mockResolvedValue({
    items: [{ ...comunicacion, tipo: 'curso', emisor: 'Laura Díaz' }],
    total: 1,
    pagina: 1,
    total_paginas: 1,
  })
  render(
    <MemoryRouter>
      <ComunicacionesPage docente />
    </MemoryRouter>,
  )
  expect(await screen.findByText('Reunión')).toBeInTheDocument()
  expect(api.mock.calls.some(([path]) => String(path).startsWith('/comunicaciones/docente?'))).toBe(
    true,
  )
  expect(screen.getByRole('link', { name: 'Nueva comunicación' })).toHaveAttribute(
    'href',
    '/docente/comunicaciones/nueva',
  )
})
