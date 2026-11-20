import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import { MisConsultasPage } from '../mis-consultas-page'

vi.mock('@/api/client')

const consulta = {
  id: 'hilo-1',
  contexto: {
    tipo: 'solicitud_ausencia_periodo',
    id: 'solicitud-1',
    alumno_nombre: 'Martina Torres',
    alumno_id: 'alumno-1',
    fecha_inicio: '2026-10-10',
    fecha_fin: '2026-10-12',
    motivo: 'Enfermedad',
  },
  estado: 'pendiente_administracion',
  updated_at: '2026-10-12T11:42:00Z',
  puede_responder: true,
  puede_gestionar: false,
  adjuntos_habilitados: false,
  ultimo_mensaje: {
    texto: 'Adjunto el comprobante',
    lado: 'familia',
    created_at: '2026-10-12T11:42:00Z',
  },
}

it('lists the family consultations and filters the pending ones', async () => {
  const api = vi.mocked(apiClient)
  api.mockResolvedValue({
    items: [consulta],
    siguiente_offset: null,
    total: 1,
    resumen: { total: 1, pendientes: 1, resueltas: 0 },
  })
  render(
    <MemoryRouter>
      <MisConsultasPage />
    </MemoryRouter>,
  )
  expect(await screen.findByText('Justificación por período')).toBeInTheDocument()
  expect(screen.getByText(/Martina Torres · Enfermedad/)).toBeInTheDocument()
  expect(screen.getByText('Vos:')).toBeInTheDocument()
  expect(screen.getByText('Pendiente de Administración')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Justificación por período/ })).toHaveAttribute(
    'href',
    '/familia/conversaciones/hilo-1',
  )

  await userEvent.click(screen.getByRole('button', { name: 'Pendientes (1)' }))
  expect(api).toHaveBeenLastCalledWith(
    '/comunicaciones/conversaciones?abiertas=true&offset=0&limite=50',
    expect.anything(),
  )
})
