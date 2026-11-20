import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import { ConversacionContextualPage } from '../conversacion-contextual-page'

vi.mock('@/api/client')

it('opens the thread from its concrete context and shows the persisted first message', async () => {
  const api = vi.mocked(apiClient)
  const contexto = {
    id: 'request',
    tipo: 'solicitud_ausencia_periodo',
    alumno_nombre: 'Ana Prueba',
    fecha_inicio: '2026-11-20',
    fecha_fin: '2026-11-23',
  }
  const hilo = { id: 'thread', contexto, estado: 'pendiente_administracion', puede_responder: true }
  api.mockImplementation(async (path, init) => {
    if (path.endsWith('/mensajes'))
      return { items: [{ id: 'm1', autor: 'Ana', texto: 'Consulta', created_at: '2026-11-20' }] }
    if (path.endsWith('/thread') || init?.method === 'POST') return hilo
    return { contexto, conversacion: null, puede_iniciar: true }
  })
  render(
    <MemoryRouter
      initialEntries={['/familia/conversaciones/contextos/solicitud_ausencia_periodo/request']}
    >
      <Routes>
        <Route
          path="/familia/conversaciones/contextos/:tipo/:contextoId"
          element={<ConversacionContextualPage familia />}
        />
        <Route
          path="/familia/conversaciones/:id"
          element={<ConversacionContextualPage familia />}
        />
      </Routes>
    </MemoryRouter>,
  )
  await userEvent.type(await screen.findByRole('textbox', { name: 'Mensaje' }), 'Consulta')
  await userEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }))
  expect(await screen.findByText('Consulta', { selector: 'p' })).toBeInTheDocument()
  expect(screen.getByText('Esperando a Administración')).toBeInTheDocument()
  expect(api).toHaveBeenCalledWith(
    '/comunicaciones/conversaciones/contextos/solicitud_ausencia_periodo/request',
    expect.objectContaining({ method: 'POST' }),
  )
})

it('groups consecutive messages from the same sender and keeps the thread scrollable', async () => {
  const api = vi.mocked(apiClient)
  const contexto = {
    id: 'request',
    tipo: 'debito_cobranza',
    alumno_nombre: 'Martina Torres',
    alumno_id: 'alumno-1',
    fecha_inicio: '2026-11-20',
    concepto: 'Cuota noviembre 2026',
    motivo: 'Saldo insuficiente',
  }
  const hilo = { id: 'thread', contexto, estado: 'pendiente_administracion', puede_responder: true }
  const mensaje = (id: string, lado: 'familia' | 'administracion', texto: string) => ({
    id,
    lado,
    autor: lado === 'familia' ? 'Familia (Andrés)' : 'Administración',
    texto,
    created_at: '2026-11-20T10:24:00Z',
  })
  api.mockImplementation(async (path) => {
    if (path.endsWith('/mensajes'))
      return {
        items: [
          mensaje('m1', 'administracion', 'Primer aviso'),
          mensaje('m2', 'administracion', 'Segundo aviso'),
          mensaje('m3', 'familia', 'Respuesta de la familia'),
        ],
        siguiente: null,
      }
    if (path.endsWith('/thread') || path.endsWith('/contextos/debito_cobranza/request')) return hilo
    return { contexto, conversacion: hilo, puede_iniciar: false }
  })
  render(
    <MemoryRouter initialEntries={['/familia/conversaciones/thread']}>
      <Routes>
        <Route
          path="/familia/conversaciones/:id"
          element={<ConversacionContextualPage familia />}
        />
      </Routes>
    </MemoryRouter>,
  )
  expect(await screen.findByText('Primer aviso')).toBeInTheDocument()
  expect(screen.getAllByText('Administración')).toHaveLength(1)
  expect(screen.getAllByText('Familia (Andrés)')).toHaveLength(1)
  expect(screen.getByRole('log', { name: 'Historial de mensajes' })).toHaveClass('overflow-y-auto')
})
