import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EjecucionesWorkflowPage } from '@/modules/workflows/pages/ejecuciones-workflow-page'
import { listarEjecucionesWorkflow } from '@/modules/workflows/services/listar-ejecuciones-workflow'
import { reintentarEjecucionWorkflow } from '@/modules/workflows/services/reintentar-ejecucion-workflow'
import { useAuthStore } from '@/store/auth-store'
import type { EjecucionWorkflow, EjecucionWorkflowListado } from '@/modules/workflows/types'

vi.mock('@/modules/workflows/services/listar-ejecuciones-workflow')
vi.mock('@/modules/workflows/services/reintentar-ejecucion-workflow')
vi.mock('sonner', () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }))

const mockedListar = vi.mocked(listarEjecucionesWorkflow)
const mockedReintentar = vi.mocked(reintentarEjecucionWorkflow)

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

function conPermisos(codigos: string[]) {
  const permisos = codigos.map((codigo, indice) => ({
    id: `p${indice}`,
    codigo,
    modulo: 'Workflows',
    accion: codigo.split('.')[1] ?? 'leer',
    tipo_informacion: null,
  }))
  useAuthStore.setState({
    usuario: {
      id: 'u1',
      email: 'admin@esseri.edu.ar',
      auth_provider: 'local',
      estado: 'activo',
      roles: ['admin'],
      permisos,
      perfiles: [{ id: 'admin', codigo: 'admin', nombre: 'admin', descripcion: null, permisos }],
      rol_activo: 'admin',
    },
    status: 'authenticated',
    rolActivo: 'admin',
  })
}

const reintentable: EjecucionWorkflow = { ...ejecucionFallida, reintentable: true }

beforeEach(() => {
  vi.clearAllMocks()
  conPermisos(['workflows.leer', 'workflows.actualizar'])
  mockedListar.mockResolvedValue({ ...listado, items: [reintentable] })
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

  it.each([
    ['exitoso', 'success'],
    ['pendiente', 'info'],
    ['fallido', 'error'],
  ] as const)('reintento con respuesta %s avisa con toast.%s y recarga', async (estado, tipo) => {
    mockedReintentar.mockResolvedValue({ ...reintentable, id: 'ej-2', intento: 2, estado })
    renderPagina()

    await userEvent.click(await screen.findByRole('button', { name: /Reintentar/ }))

    await waitFor(() => expect(toast[tipo]).toHaveBeenCalledTimes(1))
    expect(mockedReintentar).toHaveBeenCalledWith('ej-1')
    await waitFor(() => expect(mockedListar).toHaveBeenCalledTimes(2))
  })

  it('muestra el detalle del 409 y recarga', async () => {
    mockedReintentar.mockRejectedValue(new ApiError(409, 'La regla fue modificada.'))
    renderPagina()

    await userEvent.click(await screen.findByRole('button', { name: /Reintentar/ }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('La regla fue modificada.'))
    await waitFor(() => expect(mockedListar).toHaveBeenCalledTimes(2))
  })

  it('ignora un segundo clic mientras el POST sigue pendiente', async () => {
    let resolver: (valor: EjecucionWorkflow) => void = () => {}
    mockedReintentar.mockReturnValue(new Promise((resolve) => (resolver = resolve)))
    renderPagina()

    const boton = await screen.findByRole('button', { name: /Reintentar/ })
    await userEvent.click(boton)
    await userEvent.click(boton)

    expect(mockedReintentar).toHaveBeenCalledTimes(1)
    resolver({ ...reintentable, intento: 2 })
    await waitFor(() => expect(mockedListar).toHaveBeenCalledTimes(2))
  })

  it('no ofrece el reintento sin workflows.actualizar', async () => {
    conPermisos(['workflows.leer'])
    renderPagina()

    await screen.findByText('Aviso de mora')
    expect(screen.queryByRole('button', { name: /Reintentar/ })).not.toBeInTheDocument()
  })
})
