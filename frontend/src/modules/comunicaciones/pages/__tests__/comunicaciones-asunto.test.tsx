import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import { permisosActivos, useAuthStore } from '@/store/auth-store'
import { ComunicacionesPage } from '../comunicaciones-page'

vi.mock('@/api/client')
vi.mock('@/store/auth-store', { spy: true })

it('gives untitled drafts an editable link without changing existing subjects', async () => {
  vi.mocked(apiClient).mockResolvedValue({
    items: [
      { id: 'vacio', asunto: '', estado: 'borrador' },
      { id: 'espacios', asunto: '   ', estado: 'borrador' },
      { id: 'con-titulo', asunto: 'Reunión', estado: 'borrador' },
    ].map((item) => ({
      ...item,
      tipo: 'institucional',
      canal: 'portal',
      created_at: '2026-11-19T00:00:00Z',
    })),
    total: 3,
    pagina: 1,
    total_paginas: 1,
  })

  render(
    <MemoryRouter>
      <ComunicacionesPage />
    </MemoryRouter>,
  )

  const sinAsunto = await screen.findAllByRole('link', { name: 'Sin asunto' })
  expect(sinAsunto.map((link) => link.getAttribute('href'))).toEqual([
    '/comunicaciones/vacio/editar',
    '/comunicaciones/espacios/editar',
  ])
  expect(screen.getByRole('link', { name: 'Reunión' })).toHaveAttribute(
    'href',
    '/comunicaciones/con-titulo/editar',
  )
})

it('shows the management table columns, scoped totals and exact local timestamps', async () => {
  vi.mocked(apiClient).mockResolvedValue({
    items: [
      {
        id: 'publicada',
        asunto: 'Reunión',
        estado: 'publicada',
        tipo: 'institucional',
        destino: 'Primaria',
        destinatarios: 12,
        created_at: '2026-11-18T04:25:00Z',
        publicada_at: '2026-11-20T13:24:00',
        autor_nombre: 'Autor Demo',
      },
    ],
    conteos: { todas: 3, publicadas: 1, borradores: 2 },
    total: 1,
    pagina: 1,
    total_paginas: 1,
  })
  render(
    <MemoryRouter>
      <ComunicacionesPage />
    </MemoryRouter>,
  )
  expect(screen.getByPlaceholderText('Buscar por asunto o autor...')).toBeVisible()
  expect(await screen.findByRole('tab', { name: 'Todas (3)' })).toBeVisible()
  expect(screen.getByRole('tab', { name: 'Publicadas (1)' })).toBeVisible()
  expect(screen.getByRole('tab', { name: 'Borradores (2)' })).toBeVisible()
  expect(screen.getAllByRole('columnheader').map((item) => item.textContent)).toEqual([
    'Asunto',
    'Tipo',
    'Destinatarios',
    'Estado',
    'Fecha',
    'Autor',
  ])
  expect(screen.getByText('Primaria (12)')).toBeVisible()
  expect(screen.getByText('20/11/2026 10:24')).toBeVisible()
})

it('only withdraws after explicit confirmation and allows filtering archived publications', async () => {
  const user = userEvent.setup()
  const registro = {
    id: 'comunicacion-id',
    asunto: 'Reunión general',
    tipo: 'institucional',
    estado: 'publicada',
    created_at: '2026-11-18T04:25:00Z',
  }
  vi.mocked(useAuthStore).mockImplementation((selector) =>
    selector === permisosActivos ? [{ codigo: 'comunicaciones.actualizar' }] : undefined,
  )
  vi.mocked(apiClient).mockClear()
  vi.mocked(apiClient).mockImplementation(async (_, init) =>
    init?.method === 'POST'
      ? undefined
      : { items: [registro], total: 1, pagina: 1, total_paginas: 1 },
  )

  render(
    <MemoryRouter>
      <ComunicacionesPage />
    </MemoryRouter>,
  )
  await user.click(await screen.findByRole('button', { name: 'Acciones de Reunión general' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Retirar publicación' }))
  expect(screen.getByRole('alertdialog')).toHaveTextContent(
    'Los correos enviados anteriormente no pueden eliminarse',
  )
  await user.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(vi.mocked(apiClient).mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)

  await user.click(screen.getByRole('button', { name: 'Acciones de Reunión general' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Retirar publicación' }))
  await user.click(screen.getByRole('button', { name: 'Retirar publicación' }))
  expect(apiClient).toHaveBeenCalledWith('/comunicaciones/comunicacion-id/retirar', {
    method: 'POST',
  })

  await user.click(await screen.findByRole('button', { name: 'Publicaciones: Vigentes' }))
  await user.click(await screen.findByRole('radio', { name: 'Retiradas' }))
  expect(vi.mocked(apiClient).mock.calls.some(([path]) => path.includes('retirada=true'))).toBe(
    true,
  )
  expect(screen.queryByRole('tab', { name: 'Retiradas' })).not.toBeInTheDocument()
  vi.mocked(useAuthStore).mockRestore()
})

it('edits a published subject without touching delivery settings and confirms draft deletion', async () => {
  const user = userEvent.setup()
  const api = vi.mocked(apiClient)
  vi.mocked(useAuthStore).mockImplementation((selector) =>
    selector === permisosActivos
      ? [{ codigo: 'comunicaciones.actualizar' }, { codigo: 'comunicaciones.crear' }]
      : undefined,
  )
  api.mockReset()
  const base = {
    tipo: 'institucional',
    cuerpo: 'Mensaje original',
    canal: 'ambos',
    version: 2,
    created_at: '2026-11-18T04:25:00Z',
  }
  const publicada = {
    ...base,
    tipo: 'curso',
    id: 'publicada',
    asunto: 'Aviso general',
    estado: 'publicada',
  }
  const borrador = { ...base, id: 'borrador', asunto: 'Borrador de reunión', estado: 'borrador' }
  const borradorCurso = {
    ...borrador,
    id: 'borrador-curso',
    tipo: 'curso',
    asunto: 'Curso sin publicar',
  }
  api.mockImplementation(async (path) =>
    path === '/comunicaciones/publicada'
      ? publicada
      : { items: [publicada, borrador, borradorCurso], total: 3, pagina: 1, total_paginas: 1 },
  )
  render(
    <MemoryRouter>
      <ComunicacionesPage />
    </MemoryRouter>,
  )

  await user.click(await screen.findByRole('button', { name: 'Acciones de Aviso general' }))
  expect(screen.queryByRole('button', { name: 'Acciones de Curso sin publicar' })).toBeNull()
  expect(await screen.findByRole('menuitem', { name: 'Retirar publicación' })).toBeVisible()
  const editarPublicacion = await screen.findByRole('menuitem', { name: 'Editar' })
  expect(editarPublicacion.querySelector('svg')).toHaveClass('lucide-pencil')
  await user.click(editarPublicacion)
  expect(await screen.findByRole('dialog', { name: 'Editar publicación' })).toBeVisible()
  const asunto = await screen.findByRole('textbox', { name: 'Asunto' })
  await user.clear(asunto)
  await user.type(asunto, 'Aviso corregido')
  await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  expect(api).toHaveBeenCalledWith(
    '/comunicaciones/publicada/contenido',
    expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({
        asunto: 'Aviso corregido',
        cuerpo: 'Mensaje original',
        cuerpo_rico: null,
        version: 2,
      }),
    }),
  )

  await user.click(await screen.findByRole('button', { name: 'Acciones de Borrador de reunión' }))
  const editarBorrador = await screen.findByRole('menuitem', { name: 'Editar' })
  expect(editarBorrador).toHaveAttribute('href', '/comunicaciones/borrador/editar')
  expect(editarBorrador.querySelector('svg')).toHaveClass('lucide-pencil')
  const eliminar = screen.getByRole('menuitem', { name: 'Eliminar' })
  expect(eliminar.querySelector('svg')).toHaveClass('lucide-trash-2')
  await user.click(eliminar)
  expect(api.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false)
  await user.click(screen.getByRole('button', { name: 'Eliminar borrador' }))
  expect(api).toHaveBeenCalledWith('/comunicaciones/borrador?version=2', { method: 'DELETE' })
  vi.mocked(useAuthStore).mockRestore()
})

it('applies a real level and division with search, dates, and tabs and resets to the first page', async () => {
  const user = userEvent.setup()
  const api = vi.mocked(apiClient)
  api.mockReset()
  api.mockImplementation(async (path) =>
    path.endsWith('/opciones-filtros')
      ? {
          niveles: [
            { id: 'primaria', nombre: 'Primaria' },
            { id: 'secundaria', nombre: 'Secundaria' },
          ],
          divisiones: [
            { id: 'primaria-a', nombre: '1.º A', nivel_id: 'primaria' },
            { id: 'secundaria-b', nombre: '1.º B', nivel_id: 'secundaria' },
          ],
        }
      : { items: [], total: 11, pagina: 1, total_paginas: 2 },
  )
  render(
    <MemoryRouter>
      <ComunicacionesPage />
    </MemoryRouter>,
  )
  await user.click(await screen.findByRole('link', { name: '2' }))
  await waitFor(() => expect(api.mock.lastCall?.[0]).toContain('pagina=2'))
  await user.type(screen.getByRole('textbox', { name: 'Buscar comunicaciones' }), 'Laura')
  await user.click(screen.getByRole('tab', { name: 'Borradores' }))
  await user.click(screen.getByRole('button', { name: 'Fecha: Todas' }))
  const hoy = new Date()
  const mes = String(hoy.getMonth() + 1).padStart(2, '0')
  const anio = hoy.getFullYear()
  await user.click(screen.getByLabelText('Desde'))
  await user.click(await screen.findByRole('button', { name: /\b20(?:th)?\b/ }))
  expect(screen.getByLabelText('Desde')).toHaveTextContent(`20/${mes}/${anio}`)
  await user.keyboard('{Escape}')
  expect(screen.getByText(`Fecha: 20/${mes}/${anio} – Sin fin`)).toBeVisible()

  await user.click(screen.getByRole('button', { name: 'Destinatarios: Cualquier destino' }))
  expect(screen.getByRole('radio', { name: 'Cualquier destino' })).toBeChecked()
  expect(screen.getByRole('radio', { name: 'Todo el colegio' })).not.toBeChecked()
  await user.click(screen.getByRole('radio', { name: 'División' }))
  await user.click(await screen.findByRole('combobox', { name: 'Nivel educativo' }))
  await user.click(await screen.findByRole('option', { name: 'Primaria' }))
  await user.click(screen.getByRole('combobox', { name: 'División' }))
  expect(screen.queryByRole('option', { name: '1.º B' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('option', { name: '1.º A' }))
  await user.click(screen.getByRole('button', { name: 'Aplicar' }))

  const ultimaConsulta = () =>
    new URL(String(api.mock.lastCall?.[0]), 'https://example.test').searchParams
  await waitFor(() => {
    expect(Object.fromEntries(ultimaConsulta())).toMatchObject({
      pagina: '1',
      buscar: 'Laura',
      estado: 'borrador',
      destinatarios: 'division',
      nivel_id: 'primaria',
      division_id: 'primaria-a',
      fecha_desde: `${anio}-${mes}-20`,
    })
  })
  expect(screen.getByText('Destinatarios: 1.º A - Primaria', { selector: 'span' })).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
  await waitFor(() =>
    expect(Object.fromEntries(ultimaConsulta())).toEqual({
      pagina: '1',
      buscar: '',
      estado: 'borrador',
    }),
  )
})
