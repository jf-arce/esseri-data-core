import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EjecucionesWorkflowPage } from '@/modules/workflows/pages/ejecuciones-workflow-page'
import { listarEjecucionesWorkflow } from '@/modules/workflows/services/listar-ejecuciones-workflow'
import type { EjecucionWorkflow, EjecucionWorkflowListado } from '@/modules/workflows/types'

vi.mock('@/modules/workflows/services/listar-ejecuciones-workflow')

const mockedListar = vi.mocked(listarEjecucionesWorkflow)

const ejecucionFallida: EjecucionWorkflow = {
  id: 'ej-1',
  intento: 1,
  started_at: '2026-09-01T10:00:00Z',
  finished_at: '2026-09-01T10:00:01Z',
  estado: 'fallido',
  detalle: null,
  error_detail: 'La acción no pudo completarse.',
  workflow_rule_id: 'r-1',
  workflow_rule_nombre: 'Aviso de mora',
  tipo_accion: 'notificar',
  event_log_id: 'ev-1',
  tipo_evento: 'factura.vencida',
  evento_timestamp: '2026-09-01T09:59:00Z',
  entidad: 'factura',
  entidad_id: 'f-1',
  reintentable: false,
}

const listado: EjecucionWorkflowListado = {
  items: [ejecucionFallida],
  total: 60,
  pagina: 1,
  tamanio_pagina: 20,
  total_paginas: 3,
}

function renderPagina() {
  return render(
    <MemoryRouter>
      <EjecucionesWorkflowPage />
    </MemoryRouter>,
  )
}

async function elegirEstado(nombre: string) {
  await userEvent.click(screen.getByRole('button', { name: /Estado/ }))
  await userEvent.click(await screen.findByRole('radio', { name: nombre }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedListar.mockResolvedValue(listado)
})

describe('EjecucionesWorkflowPage', () => {
  it('al cambiar el filtro vuelve a la página 1', async () => {
    renderPagina()
    await userEvent.click(await screen.findByText('2'))
    await waitFor(() => expect(mockedListar.mock.lastCall?.[0].pagina).toBe(2))

    await elegirEstado('Fallida')

    await waitFor(() =>
      expect(mockedListar.mock.lastCall?.[0]).toMatchObject({ estado: 'fallido', pagina: 1 }),
    )
  })

  it('al volver a "Todos" omite el estado', async () => {
    renderPagina()
    await screen.findByText('Aviso de mora')

    await elegirEstado('Fallida')
    await waitFor(() => expect(mockedListar.mock.lastCall?.[0].estado).toBe('fallido'))
    await elegirEstado('Todos')

    await waitFor(() => expect(mockedListar.mock.lastCall?.[0].estado).toBeUndefined())
  })

  it('abre el detalle de una ejecución', async () => {
    renderPagina()

    await userEvent.click(await screen.findByRole('button', { name: /Ver detalle/ }))

    expect(await screen.findByRole('dialog')).toHaveTextContent('La acción no pudo completarse.')
  })
})
