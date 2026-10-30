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
  canal: 'portal',
}
const adjunto = {
  id: 'a1',
  nombre: 'acta.pdf',
  tipo_contenido: 'application/pdf',
  tamanio: 1024,
  estado: 'cuarentena' as const,
}

beforeEach(() => {
  vi.resetAllMocks()
  api.mockImplementation(async (path, options) => {
    if (path.includes('/opciones'))
      return { responsables: [], alumnos: [], niveles: [], divisiones: [], ciclos: [] }
    if (path.includes('/vista-previa')) return { destinatarios: 2 }
    if (path.endsWith('/adjuntos')) return options?.method === 'POST' ? adjunto : []
    if (path.includes('/envios')) return []
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
  expect(await screen.findByText(/Institucional · 2 responsables/)).toBeInTheDocument()
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
  expect(await screen.findByText(/Comunicación de curso · 1 responsables/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Publicar' }))
  expect(await screen.findByRole('heading', { name: 'Comunicación publicada' })).toBeInTheDocument()
  expect(api.mock.calls.some(([path]) => path === '/comunicaciones/docente')).toBe(true)
  expect(api.mock.calls.some(([path]) => path === '/comunicaciones/docente/c1/publicar')).toBe(true)
})

it('changing an edited teacher draft cycle preserves unsaved content and reloads only options', async () => {
  const draft = {
    ...comunicacion,
    tipo: 'curso',
    cuerpo: 'Original message',
    audiencia: { tipo: 'division', ids: ['d1'], ciclo_lectivo: '2027' },
  }
  api.mockImplementation(async (path) => {
    if (path.includes('/opciones'))
      return {
        responsables: [],
        alumnos: [],
        niveles: [],
        divisiones: [
          {
            id: path.includes('2028') ? 'd2' : 'd1',
            nombre: path.includes('2028') ? 'New course' : 'Old course',
          },
        ],
        ciclos: ['2027', '2028'],
      }
    return draft
  })
  render(
    <MemoryRouter initialEntries={['/docente/comunicaciones/c1/editar']}>
      <Routes>
        <Route
          path="/docente/comunicaciones/:id/editar"
          element={<ComunicacionFormPage docente />}
        />
      </Routes>
    </MemoryRouter>,
  )
  await screen.findByDisplayValue('Reunión')
  await userEvent.type(screen.getByLabelText('Asunto'), ' updated')
  await userEvent.type(screen.getByLabelText('Mensaje'), ' updated')
  await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
  screen.getByRole('combobox', { name: 'Ciclo lectivo' }).focus()
  await userEvent.keyboard('[ArrowDown]')
  await userEvent.keyboard('[End][Enter]')
  await userEvent.click(await screen.findByLabelText('New course'))
  expect(screen.getByRole('combobox', { name: 'Ciclo lectivo' })).toHaveTextContent('2028')
  expect(api.mock.calls.filter(([path]) => path === '/comunicaciones/docente/c1')).toHaveLength(1)
  await userEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
  await screen.findByText('Borrador guardado')
  const saved = api.mock.calls.find(
    ([path, options]) => path === '/comunicaciones/docente/c1' && options?.method === 'PUT',
  )
  expect(saved).toBeDefined()
  expect(JSON.parse(saved![1]!.body as string)).toEqual(
    expect.objectContaining({
      asunto: 'Reunión updated',
      cuerpo: 'Original message updated',
      audiencia: { tipo: 'division', ids: ['d2'], ciclo_lectivo: '2028' },
    }),
  )
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

it('persists the email-only channel and never claims portal availability', async () => {
  api.mockImplementation(async (path, options) => {
    if (path.endsWith('/adjuntos')) return options?.method === 'POST' ? adjunto : []
    if (path.includes('/vista-previa')) return { destinatarios: 2 }
    if (path.includes('/publicar'))
      return { ...comunicacion, canal: 'email', estado: 'publicada', destinatarios: 2 }
    if (path.includes('?')) return { items: [], total: 0, pagina: 1, total_paginas: 0 }
    if (path.includes('/envios')) return []
    return comunicacion
  })
  render(
    <MemoryRouter>
      <ComunicacionFormPage />
    </MemoryRouter>,
  )
  await userEvent.type(screen.getByLabelText('Asunto'), 'Aviso')
  await userEvent.type(screen.getByLabelText('Mensaje'), 'Solo por correo')
  await userEvent.click(screen.getByRole('radio', { name: /Solo email/ }))
  expect(screen.getByText(/No aparece en la bandeja del portal/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
  await screen.findByText('Borrador guardado')
  const guardado = api.mock.calls.find(
    ([path, options]) => path === '/comunicaciones' && options?.method === 'POST',
  )
  expect(JSON.parse(guardado![1]!.body as string).canal).toBe('email')

  await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
  await userEvent.click(screen.getByRole('button', { name: 'Vista previa' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Publicar y encolar email' }))
  expect(
    await screen.findByText('Los responsables reciben esta comunicación por email.'),
  ).toBeInTheDocument()
  expect(screen.getByText(/quedó en cola para 2 responsables/)).toBeInTheDocument()
  expect(screen.queryByText(/Disponible en el portal/)).toBeNull()
})

it('requires a saved draft before upload and blocks publishing while a file is quarantined', async () => {
  render(
    <MemoryRouter>
      <ComunicacionFormPage />
    </MemoryRouter>,
  )
  expect(await screen.findByText('Guardá el borrador para adjuntar archivos.')).toBeInTheDocument()
  expect(document.querySelector('input[type="file"]')).toBeNull()

  await userEvent.type(screen.getByLabelText('Asunto'), 'Con adjunto')
  await userEvent.type(screen.getByLabelText('Mensaje'), 'Acta adjunta')
  await userEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
  await screen.findByText('Borrador guardado')

  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  await userEvent.upload(input, new File(['contenido'], 'acta.pdf', { type: 'application/pdf' }))
  expect(await screen.findByText('En cuarentena')).toBeInTheDocument()
  expect(
    screen.getByText('Archivo agregado. Queda en cuarentena hasta completar el análisis.'),
  ).toBeInTheDocument()
  expect(api.mock.calls.some(([path]) => path === '/comunicaciones/c1/adjuntos')).toBe(true)

  await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
  await userEvent.click(screen.getByRole('button', { name: 'Vista previa' }))
  expect(
    await screen.findByText('Todos los archivos adjuntos deben estar limpios para publicar.'),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Publicar' })).toBeDisabled()
})

it('lets a clean file be published and keeps its state after changing the cycle', async () => {
  const limpio = { ...adjunto, estado: 'limpio' as const }
  const draft = {
    ...comunicacion,
    tipo: 'curso' as const,
    audiencia: { tipo: 'division' as const, ids: ['d1'], ciclo_lectivo: '2027' },
    adjuntos: [limpio],
  }
  api.mockImplementation(async (path, options) => {
    if (path.endsWith('/adjuntos')) return options?.method === 'POST' ? limpio : [limpio]
    if (path.includes('/opciones'))
      return {
        responsables: [],
        alumnos: [],
        niveles: [],
        divisiones: [{ id: 'd2', nombre: 'Otro curso' }],
        ciclos: ['2027', '2028'],
      }
    if (path.includes('/vista-previa')) return { destinatarios: 1 }
    return draft
  })
  render(
    <MemoryRouter initialEntries={['/docente/comunicaciones/c1/editar']}>
      <Routes>
        <Route
          path="/docente/comunicaciones/:id/editar"
          element={<ComunicacionFormPage docente />}
        />
      </Routes>
    </MemoryRouter>,
  )
  expect(await screen.findByText('Limpio')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
  screen.getByRole('combobox', { name: 'Ciclo lectivo' }).focus()
  await userEvent.keyboard('[ArrowDown]')
  await userEvent.keyboard('[End][Enter]')
  await userEvent.click(await screen.findByLabelText('Otro curso'))
  expect(screen.getByRole('combobox', { name: 'Ciclo lectivo' })).toHaveTextContent('2028')
  // El panel de archivos vive en el paso 1: volver atrás comprueba que el estado se conserve
  // sin volver a pedir el borrador ni la lista de adjuntos.
  await userEvent.click(screen.getByRole('button', { name: 'Anterior' }))
  expect(screen.getByText('Limpio')).toBeInTheDocument()
  expect(
    api.mock.calls.filter(([path]) => path === '/comunicaciones/docente/c1/adjuntos'),
  ).toHaveLength(1)
  await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
  await userEvent.click(screen.getByRole('button', { name: 'Vista previa' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Publicar' }))
  expect(await screen.findByRole('heading', { name: 'Comunicación publicada' })).toBeInTheDocument()
  expect(api.mock.calls.some(([path]) => path === '/comunicaciones/docente/c1/publicar')).toBe(true)
})

it('does not register portal reading for an email-only communication', async () => {
  api.mockImplementation(async (path) => {
    if (path.includes('/envios')) return []
    return {
      ...comunicacion,
      canal: 'email',
      estado: 'publicada',
      publicada_at: '2026-10-29T12:00:00',
    }
  })
  render(
    <MemoryRouter initialEntries={['/familia/comunicaciones/c1']}>
      <Routes>
        <Route path="/familia/comunicaciones/:id" element={<ComunicacionDetallePage familia />} />
      </Routes>
    </MemoryRouter>,
  )
  expect(
    await screen.findByText(
      'Esta comunicación se envía por email y no aparece en la bandeja del portal.',
    ),
  ).toBeInTheDocument()
  expect(api.mock.calls.some(([path]) => path.includes('/lectura'))).toBe(false)
})

it('shows email attempts and marks uncertain outcomes without claiming delivery', async () => {
  api.mockImplementation(async (path) => {
    if (path.includes('/envios'))
      return [
        {
          id: 'e1',
          email: 'responsable@ejemplo.com',
          estado: 'incierto',
          intentos: [
            {
              id: 'i1',
              estado: 'incierto',
              error_codigo: 'timeout',
              started_at: '2026-10-29T12:00:00',
              finished_at: null,
            },
          ],
        },
      ]
    return {
      ...comunicacion,
      canal: 'ambos',
      estado: 'publicada',
      publicada_at: '2026-10-29T12:00:00',
    }
  })
  render(
    <MemoryRouter initialEntries={['/comunicaciones/c1']}>
      <Routes>
        <Route path="/comunicaciones/:id" element={<ComunicacionDetallePage />} />
      </Routes>
    </MemoryRouter>,
  )
  expect(await screen.findByText('responsable@ejemplo.com')).toBeInTheDocument()
  expect(screen.getByText('Resultado incierto')).toBeInTheDocument()
  expect(screen.getByText(/no se confirma que el mensaje haya sido entregado/)).toBeInTheDocument()
  expect(screen.queryByText('Entregado')).toBeNull()
  expect(api.mock.calls.some(([path]) => path === '/comunicaciones/c1/envios')).toBe(true)
})
