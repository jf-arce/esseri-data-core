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
  expect(screen.getByText('Pendiente de Administración')).toBeInTheDocument()
  expect(api).toHaveBeenCalledWith(
    '/comunicaciones/conversaciones/contextos/solicitud_ausencia_periodo/request',
    expect.objectContaining({ method: 'POST' }),
  )
})
