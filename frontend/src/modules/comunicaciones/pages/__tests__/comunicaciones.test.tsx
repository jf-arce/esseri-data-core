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
  version: 1,
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
const entregaBase = {
  items: [],
  resumen: {
    responsables: 0,
    responsables_con_email: 0,
    responsables_sin_email: 0,
    responsables_leidos: 0,
    responsables_no_leidos: 0,
    emails: 0,
    emails_aceptados: 0,
    emails_pendientes: 0,
    emails_fallidos: 0,
    emails_inciertos: 0,
    email_aplica: true,
    lectura_aplica: true,
  },
  total: 0,
  pagina: 1,
  total_paginas: 0,
}

const publicadaDetalle = {
  ...comunicacion,
  asunto: 'Actualización de datos del alumno',
  estado: 'publicada',
  publicada_at: '2026-11-13T18:26:00Z',
  leida_at: '2026-11-13T18:30:00Z',
}

function renderDetalleFamilia(id = 'c1') {
  render(
    <MemoryRouter initialEntries={[`/familia/comunicaciones/${id}`]}>
      <Routes>
        <Route path="/familia/comunicaciones/:id" element={<ComunicacionDetallePage familia />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  api.mockImplementation(async (path, options) => {
    if (path.includes('/opciones'))
      return { responsables: [], alumnos: [], niveles: [], divisiones: [], ciclos: [] }
    if (path.includes('/vista-previa')) return { destinatarios: 2 }
    if (path.endsWith('/adjuntos')) return options?.method === 'POST' ? adjunto : []
    if (path.includes('/entrega')) return entregaBase
    if (path.includes('/envios')) return []
    if (path.includes('/publicar'))
      return { ...comunicacion, estado: 'publicada', destinatarios: 2 }
    if (path.includes('/lectura')) return { ...comunicacion, leida_at: '2026-10-29T12:01:00' }
    if (path.includes('?')) return { items: [comunicacion], total: 1, pagina: 1, total_paginas: 1 }
    return comunicacion
  })
})

it('links the steps with a line that fills instead of a step counter', async () => {
  render(
    <MemoryRouter>
      <ComunicacionFormPage />
    </MemoryRouter>,
  )
  expect(screen.queryByText(/Paso 1 de 4/)).not.toBeInTheDocument()
  const conectores = () => [...document.querySelectorAll('[data-completado]')]
  expect(conectores()).toHaveLength(3)
  expect(conectores().map((c) => c.getAttribute('data-completado'))).toEqual(['no', 'no', 'no'])
  await userEvent.type(screen.getByLabelText('Asunto'), 'Aviso')
  await userEvent.type(screen.getByLabelText('Mensaje'), 'Contenido')
  await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
  expect(conectores().map((c) => c.getAttribute('data-completado'))).toEqual(['si', 'no', 'no'])
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
  expect(await screen.findByText('Borrador guardado')).toBeInTheDocument()
  expect(api.mock.calls.some(([path]) => path.includes('/publicar'))).toBe(false)
})

it.each([
  ['Administrativa', 'administrativa'],
  ['Otro', 'otro'],
])('persists the selected %s type and retains it between steps', async (label, tipo) => {
  render(
    <MemoryRouter>
      <ComunicacionFormPage />
    </MemoryRouter>,
  )
  expect(screen.queryByRole('radio', { name: 'Curso' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('radio', { name: label }))
  await userEvent.type(screen.getByLabelText('Asunto'), 'Aviso')
  await userEvent.type(screen.getByLabelText('Mensaje'), 'Contenido')
  await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
  await userEvent.click(screen.getByRole('button', { name: 'Anterior' }))
  expect(screen.getByRole('radio', { name: label })).toBeChecked()
  await userEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
  await screen.findByText('Borrador guardado')
  expect(api).toHaveBeenCalledWith(
    '/comunicaciones',
    expect.objectContaining({
      body: expect.stringContaining(`"tipo":"${tipo}"`),
    }),
  )
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

it.each([
  ['Alumnos seleccionados', 'Buscar alumnos', 'alumnos'],
  ['Responsables seleccionados', 'Buscar responsables', 'responsables'],
])('expands %s and preserves selections when searching', async (label, searchLabel, tipo) => {
  const original = api.getMockImplementation()!
  api.mockImplementation(async (path, options) =>
    path.includes('/opciones')
      ? {
          responsables: [
            { id: 'r1', nombre: 'Ana Martín' },
            { id: 'r2', nombre: 'Lucía Pérez' },
          ],
          alumnos: [
            { id: 'a1', nombre: 'Ana Martín' },
            { id: 'a2', nombre: 'Lucía Pérez' },
          ],
          niveles: [{ id: 'n1', nombre: 'Primaria' }],
          divisiones: [],
          ciclos: ['2026'],
        }
      : original(path, options),
  )
  render(
    <MemoryRouter>
      <ComunicacionFormPage />
    </MemoryRouter>,
  )
  await userEvent.type(screen.getByLabelText('Asunto'), 'Aviso')
  await userEvent.type(screen.getByLabelText('Mensaje'), 'Contenido')
  await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
  expect(screen.queryByRole('region', { name: label })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('radio', { name: label }))
  expect(screen.getByRole('region', { name: label })).toBeInTheDocument()
  await userEvent.click(await screen.findByRole('checkbox', { name: 'Ana Martín' }))
  await userEvent.type(screen.getByRole('searchbox', { name: searchLabel }), 'perez')
  expect(screen.queryByRole('checkbox', { name: 'Ana Martín' })).not.toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: 'Lucía Pérez' })).toBeInTheDocument()
  expect(screen.getByText('1 seleccionado')).toBeInTheDocument()
  await userEvent.clear(screen.getByRole('searchbox', { name: searchLabel }))
  expect(screen.getByRole('checkbox', { name: 'Ana Martín' })).toBeChecked()
  await userEvent.type(screen.getByRole('searchbox', { name: searchLabel }), 'inexistente')
  expect(screen.getByText('No hay coincidencias para esta búsqueda.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
  await screen.findByText('Borrador guardado')
  const saved = api.mock.calls.find(([path]) => path === '/comunicaciones')!
  expect(JSON.parse(saved[1]!.body as string).audiencia).toMatchObject({
    tipo,
    ids: [tipo === 'alumnos' ? 'a1' : 'r1'],
  })
  await userEvent.click(screen.getByRole('radio', { name: 'Nivel educativo' }))
  expect(screen.queryByRole('region', { name: label })).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Nivel educativo' })).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Ciclo lectivo' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('radio', { name: 'Todos los responsables habilitados' }))
  expect(screen.queryByRole('region', { name: 'Nivel educativo' })).not.toBeInTheDocument()
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
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

it('renders the family detail hero with type, title and long Buenos Aires date', async () => {
  api.mockImplementation(async (path) => {
    if (path.startsWith('/comunicaciones/familia?'))
      return { items: [publicadaDetalle], total: 1, pagina: 1, total_paginas: 1 }
    return publicadaDetalle
  })

  renderDetalleFamilia()

  expect(await screen.findByText('COMUNICADO INSTITUCIONAL')).toBeInTheDocument()
  expect(
    screen.getByRole('heading', { name: 'Actualización de datos del alumno' }),
  ).toBeInTheDocument()
  expect(screen.getByText('13 de noviembre de 2026, 15:26')).toBeInTheDocument()
  expect(screen.getByText('Colegio ESSERI')).toBeInTheDocument()
  expect(screen.queryByText('Solo portal')).not.toBeInTheDocument()
  expect(screen.queryByText('Lectura registrada')).not.toBeInTheDocument()
  expect(screen.queryByText('Archivos adjuntos')).not.toBeInTheDocument()
})

it('derives previous and next links plus the position from the family list', async () => {
  const items = Array.from({ length: 8 }, (_, index) => ({
    ...publicadaDetalle,
    id: `c${index + 1}`,
    asunto: `Comunicado ${index + 1}`,
    tipo: 'curso',
    emisor: 'Laura Díaz',
  }))
  api.mockImplementation(async (path) => {
    if (path.startsWith('/comunicaciones/familia?'))
      return { items, total: 8, pagina: 1, total_paginas: 1 }
    return items[1]
  })

  renderDetalleFamilia('c2')

  expect(await screen.findByText('2 de 8')).toBeInTheDocument()
  expect(screen.getByText('COMUNICADO DE CURSO')).toBeInTheDocument()
  expect(screen.getByText('Laura Díaz')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Anterior/ })).toHaveAttribute(
    'href',
    '/familia/comunicaciones/c1',
  )
  expect(screen.getByRole('link', { name: /Siguiente/ })).toHaveAttribute(
    'href',
    '/familia/comunicaciones/c3',
  )
})

it('disables the previous action at the newest communication', async () => {
  const items = Array.from({ length: 8 }, (_, index) => ({
    ...publicadaDetalle,
    id: `c${index + 1}`,
    asunto: `Comunicado ${index + 1}`,
  }))
  api.mockImplementation(async (path) => {
    if (path.startsWith('/comunicaciones/familia?'))
      return { items, total: 8, pagina: 1, total_paginas: 1 }
    return items[0]
  })

  renderDetalleFamilia('c1')

  expect(await screen.findByText('1 de 8')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Anterior/ })).not.toBeInTheDocument()
  expect(screen.getByText('Anterior').closest('[aria-disabled="true"]')).not.toBeNull()
  expect(screen.getByRole('link', { name: /Siguiente/ })).toHaveAttribute(
    'href',
    '/familia/comunicaciones/c2',
  )
})

it('hides the family pager when the current communication is not in the list', async () => {
  const items = Array.from({ length: 8 }, (_, index) => ({
    ...publicadaDetalle,
    id: `c${index + 2}`,
    asunto: `Comunicado ${index + 2}`,
  }))
  api.mockImplementation(async (path) => {
    if (path.startsWith('/comunicaciones/familia?'))
      return { items, total: 8, pagina: 1, total_paginas: 1 }
    return publicadaDetalle
  })

  renderDetalleFamilia('c1')

  expect(
    await screen.findByRole('heading', { name: 'Actualización de datos del alumno' }),
  ).toBeInTheDocument()
  await waitFor(() =>
    expect(api.mock.calls.some(([path]) => path.includes('tamanio=50'))).toBe(true),
  )
  expect(
    screen.queryByRole('navigation', { name: 'Navegación entre comunicaciones' }),
  ).not.toBeInTheDocument()
})

it('hides the family pager when the loaded list does not cover the total', async () => {
  const items = Array.from({ length: 8 }, (_, index) => ({
    ...publicadaDetalle,
    id: `c${index + 1}`,
    asunto: `Comunicado ${index + 1}`,
  }))
  api.mockImplementation(async (path) => {
    if (path.startsWith('/comunicaciones/familia?'))
      return { items, total: 9, pagina: 1, total_paginas: 1 }
    return items[1]
  })

  renderDetalleFamilia('c2')

  expect(await screen.findByRole('heading', { name: 'Comunicado 2' })).toBeInTheDocument()
  await waitFor(() =>
    expect(api.mock.calls.some(([path]) => path.includes('tamanio=50'))).toBe(true),
  )
  expect(
    screen.queryByRole('navigation', { name: 'Navegación entre comunicaciones' }),
  ).not.toBeInTheDocument()
})

it('family inbox shows the list with type, unread marker and no management actions', async () => {
  render(
    <MemoryRouter>
      <ComunicacionesPage familia />
    </MemoryRouter>,
  )
  expect(await screen.findByText('Institucional')).toBeInTheDocument()
  expect(screen.getByText('Reunión')).toBeInTheDocument()
  expect(screen.queryByText('No leída')).toBeNull()
  expect(screen.queryByRole('link', { name: 'Nueva comunicación' })).toBeNull()
})

it('family inbox marks course communications with their type', async () => {
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
  expect(await screen.findByText('Curso')).toBeInTheDocument()
  expect(screen.queryByText('Institucional')).toBeNull()
})

it('family inbox sorts by date from newest to oldest', async () => {
  render(
    <MemoryRouter>
      <ComunicacionesPage familia />
    </MemoryRouter>,
  )
  await screen.findByText('Institucional')

  const selector = screen.getByRole('combobox', {
    name: 'Ordenar comunicaciones por fecha',
  })
  expect(selector).toHaveTextContent('Fecha: más recientes')

  await userEvent.click(selector)
  await userEvent.click(await screen.findByRole('option', { name: /Más antiguas primero/ }))

  expect(selector).toHaveTextContent('Fecha: más antiguas')
  await waitFor(() =>
    expect(api.mock.calls.some(([path]) => String(path).includes('orden=antiguas'))).toBe(true),
  )
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
  const publicacion = api.mock.calls.find(
    ([path]) => path === '/comunicaciones/docente/c1/publicar',
  )
  expect(JSON.parse(publicacion![1]!.body as string)).toEqual({ version: 1 })
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

it('automatically saves before uploading and blocks publishing while a file is quarantined', async () => {
  render(
    <MemoryRouter>
      <ComunicacionFormPage />
    </MemoryRouter>,
  )
  expect(document.querySelector('input[type="file"]')).not.toBeNull()

  await userEvent.type(screen.getByLabelText('Asunto'), 'Con adjunto')
  await userEvent.type(screen.getByLabelText('Mensaje'), 'Acta adjunta')

  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  await userEvent.upload(input, new File(['contenido'], 'acta.pdf', { type: 'application/pdf' }))
  expect(await screen.findByText('Analizando')).toBeInTheDocument()
  expect(
    screen.getByText('Archivo agregado. Queda en cuarentena hasta completar el análisis.'),
  ).toBeInTheDocument()
  expect(api.mock.calls.some(([path]) => path === '/comunicaciones/c1/adjuntos')).toBe(true)
  const paths = api.mock.calls.map(([path]) => path)
  expect(paths.indexOf('/comunicaciones')).toBeLessThan(
    paths.indexOf('/comunicaciones/c1/adjuntos'),
  )
  expect(paths.some((path) => path.includes('/publicar'))).toBe(false)

  await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
  await userEvent.click(screen.getByRole('button', { name: 'Vista previa' }))
  expect(
    await screen.findByText('Todos los archivos adjuntos deben estar verificados para publicar.'),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Publicar' })).toBeDisabled()
})

it('does not save or upload when required content is missing', async () => {
  render(
    <MemoryRouter>
      <ComunicacionFormPage />
    </MemoryRouter>,
  )
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  await userEvent.upload(input, new File(['contenido'], 'acta.pdf', { type: 'application/pdf' }))
  expect(
    await screen.findByText('Completá el asunto y el mensaje antes de adjuntar archivos.'),
  ).toBeInTheDocument()
  expect(
    api.mock.calls.some(([path]) => path === '/comunicaciones' || path.endsWith('/adjuntos')),
  ).toBe(false)
  expect(screen.getByRole('button', { name: 'Guardar borrador' })).not.toBeDisabled()
})

it('keeps successfully uploaded files visible when a later upload fails', async () => {
  const original = api.getMockImplementation()!
  let uploads = 0
  api.mockImplementation(async (path, options) => {
    if (path.endsWith('/adjuntos') && options?.method === 'POST' && ++uploads === 2)
      throw new Error('Upload failed')
    return original(path, options)
  })
  render(
    <MemoryRouter>
      <ComunicacionFormPage />
    </MemoryRouter>,
  )
  await userEvent.type(screen.getByLabelText('Asunto'), 'Aviso')
  await userEvent.type(screen.getByLabelText('Mensaje'), 'Contenido')
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  await userEvent.upload(input, [
    new File(['contenido'], 'acta.pdf', { type: 'application/pdf' }),
    new File(['contenido'], 'otro.pdf', { type: 'application/pdf' }),
  ])
  expect(
    await screen.findByText('No se pudo subir el archivo. Intentá de nuevo.'),
  ).toBeInTheDocument()
  expect(screen.getByText('acta.pdf')).toBeInTheDocument()
  expect(screen.getByText('Analizando')).toBeInTheDocument()
})

it('does not upload if automatic draft saving fails', async () => {
  render(
    <MemoryRouter>
      <ComunicacionFormPage />
    </MemoryRouter>,
  )
  await userEvent.type(screen.getByLabelText('Asunto'), 'Aviso')
  await userEvent.type(screen.getByLabelText('Mensaje'), 'Contenido')
  api.mockRejectedValueOnce(new Error('No se pudo guardar el borrador. Intentá de nuevo.'))
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  await userEvent.upload(input, new File(['contenido'], 'acta.pdf', { type: 'application/pdf' }))
  expect(
    await screen.findByText('No se pudo guardar el borrador. Intentá de nuevo.'),
  ).toBeInTheDocument()
  expect(api.mock.calls.some(([path]) => path.endsWith('/adjuntos'))).toBe(false)
  expect(screen.getByRole('button', { name: 'Guardar borrador' })).not.toBeDisabled()
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
  expect(await screen.findByText('acta.pdf')).toBeInTheDocument()
  expect(screen.queryByText('Verificado')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
  screen.getByRole('combobox', { name: 'Ciclo lectivo' }).focus()
  await userEvent.keyboard('[ArrowDown]')
  await userEvent.keyboard('[End][Enter]')
  await userEvent.click(await screen.findByLabelText('Otro curso'))
  expect(screen.getByRole('combobox', { name: 'Ciclo lectivo' })).toHaveTextContent('2028')
  // El panel de archivos vive en el paso 1: volver atrás comprueba que el estado se conserve
  // sin volver a pedir el borrador ni la lista de adjuntos.
  await userEvent.click(screen.getByRole('button', { name: 'Anterior' }))
  expect(screen.getByText('acta.pdf')).toBeInTheDocument()
  expect(screen.queryByText('Verificado')).not.toBeInTheDocument()
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
    if (path.includes('/entrega'))
      return {
        ...entregaBase,
        items: [
          {
            id: 'r1',
            nombre: 'Familia Prueba',
            leida_at: null,
            emails: [
              {
                id: 'e1',
                email: 'responsable@ejemplo.com',
                estado: 'incierto',
                intentos: [
                  {
                    id: 'i1',
                    estado: 'incierto',
                    error_codigo: 'timeout',
                    started_at: '2026-10-29T12:00:00Z',
                    finished_at: null,
                  },
                ],
              },
            ],
          },
        ],
        resumen: {
          ...entregaBase.resumen,
          responsables: 1,
          responsables_con_email: 1,
          responsables_no_leidos: 1,
          emails: 1,
          emails_inciertos: 1,
        },
        total: 1,
        total_paginas: 1,
      }
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
  await userEvent.click(await screen.findByRole('tab', { name: /Entrega/ }))
  expect(await screen.findByText('responsable@ejemplo.com')).toBeInTheDocument()
  expect(screen.getByText('Resultado incierto')).toBeInTheDocument()
  expect(screen.getByText(/no se confirma que el mensaje haya sido entregado/)).toBeInTheDocument()
  expect(screen.queryByText('Entregado')).toBeNull()
  expect(api.mock.calls.some(([path]) => path.includes('/entrega'))).toBe(true)
})

it('keeps staff message separate from delivery and uses compact Buenos Aires metadata', async () => {
  api.mockImplementation(async (path) =>
    path.includes('/entrega')
      ? entregaBase
      : {
          ...comunicacion,
          asunto: 'Acto de fin de año',
          estado: 'publicada',
          canal: 'ambos',
          publicada_at: '2026-10-30T22:04:59Z',
          destinatarios: 2,
        },
  )
  render(
    <MemoryRouter initialEntries={['/comunicaciones/c1']}>
      <Routes>
        <Route path="/comunicaciones/:id" element={<ComunicacionDetallePage />} />
      </Routes>
    </MemoryRouter>,
  )
  expect(await screen.findByRole('heading', { name: 'Acto de fin de año' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Mensaje' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByText(/30 oct.*2026.*19:04/)).toBeInTheDocument()
  expect(screen.queryByText(/19:04:59/)).not.toBeInTheDocument()
  expect(screen.getByText('Publicada')).toBeInTheDocument()
  expect(api.mock.calls.some(([path]) => path.includes('/entrega'))).toBe(false)
  expect(document.querySelector('[data-slot="badge"]')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Ver entrega' }))
  expect(await screen.findByText('No hay destinatarios para mostrar.')).toBeInTheDocument()
  expect(screen.getByText('Destinatarios')).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Entrega (2)' })).toHaveFocus()
  expect(screen.queryByText('<script>secreto</script>')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('tab', { name: 'Mensaje' }))
  expect(await screen.findByText('<script>secreto</script>')).toBeInTheDocument()
  expect(api.mock.calls.some(([path]) => path.includes('/lectura'))).toBe(false)
})

it('supports delivery deep links and portal-only communications without email requests', async () => {
  api.mockImplementation(async (path) => {
    if (path.includes('/entrega'))
      return {
        ...entregaBase,
        items: [
          {
            id: 'r1',
            nombre: 'Familia Prueba',
            emails: [],
            contactos: [{ id: 'u1', email: 'familia@example.test' }],
            leida_at: null,
          },
        ],
        resumen: {
          ...entregaBase.resumen,
          responsables: 1,
          responsables_no_leidos: 1,
          email_aplica: false,
        },
        total: 1,
        total_paginas: 1,
      }
    return { ...comunicacion, estado: 'publicada', canal: 'portal', destinatarios: 2 }
  })
  render(
    <MemoryRouter initialEntries={['/comunicaciones/c1?vista=entrega']}>
      <Routes>
        <Route path="/comunicaciones/:id" element={<ComunicacionDetallePage />} />
      </Routes>
    </MemoryRouter>,
  )
  expect(await screen.findByRole('region', { name: 'Entrega' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Entrega' })).not.toBeInTheDocument()
  expect(screen.queryByText(/Seguimiento por destinatario/)).not.toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Entrega (2)' })).toHaveAttribute('aria-selected', 'true')
  // The section mounts before its delivery data; await the rows instead of racing them.
  expect(await screen.findByText('Familia Prueba')).toBeInTheDocument()
  expect(await screen.findByRole('cell', { name: 'No leído' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Email' })).toBeInTheDocument()
  expect(screen.getByText('familia@example.test')).toBeInTheDocument()
  expect(screen.queryByText('Sin envío')).not.toBeInTheDocument()
  expect(screen.queryByText('Emails')).not.toBeInTheDocument()
  expect(api.mock.calls.some(([path]) => path.includes('/entrega'))).toBe(true)
  expect(api.mock.calls.some(([path]) => path.includes('/envios'))).toBe(false)
})

it('supports keyboard tab navigation and never shows staff delivery to families', async () => {
  const { unmount } = render(
    <MemoryRouter initialEntries={['/comunicaciones/c1']}>
      <Routes>
        <Route path="/comunicaciones/:id" element={<ComunicacionDetallePage />} />
      </Routes>
    </MemoryRouter>,
  )
  const mensaje = await screen.findByRole('tab', { name: 'Mensaje' })
  mensaje.focus()
  await userEvent.keyboard('[ArrowRight]')
  expect(
    await screen.findByText('La entrega se genera al publicar la comunicación.'),
  ).toBeInTheDocument()
  unmount()
  render(
    <MemoryRouter initialEntries={['/familia/comunicaciones/c1?vista=entrega']}>
      <Routes>
        <Route path="/familia/comunicaciones/:id" element={<ComunicacionDetallePage familia />} />
      </Routes>
    </MemoryRouter>,
  )
  expect(await screen.findByText('<script>secreto</script>')).toBeInTheDocument()
  expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  expect(api.mock.calls.some(([path]) => path.includes('/entrega'))).toBe(false)
})
