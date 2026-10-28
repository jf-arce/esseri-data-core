import { abrirMenuDeFila, elegirAccion } from '@/modules/workflows/__tests__/menu-acciones'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EjecucionesWorkflowPage } from '@/modules/workflows/pages/ejecuciones-workflow-page'
import { aprobarEjecucionWorkflow } from '@/modules/workflows/services/aprobar-ejecucion-workflow'
import { obtenerEjecucionWorkflow } from '@/modules/workflows/services/obtener-ejecucion-workflow'
import { listarEjecucionesWorkflow } from '@/modules/workflows/services/listar-ejecuciones-workflow'
import { rechazarEjecucionWorkflow } from '@/modules/workflows/services/rechazar-ejecucion-workflow'
import { reintentarEjecucionWorkflow } from '@/modules/workflows/services/reintentar-ejecucion-workflow'
import { useAuthStore } from '@/store/auth-store'
import type { EjecucionWorkflow, EjecucionWorkflowListado } from '@/modules/workflows/types'

vi.mock('@/modules/workflows/services/listar-ejecuciones-workflow')
vi.mock('@/modules/workflows/services/obtener-ejecucion-workflow')
vi.mock('@/modules/workflows/services/reintentar-ejecucion-workflow')
vi.mock('@/modules/workflows/services/aprobar-ejecucion-workflow')
vi.mock('@/modules/workflows/services/rechazar-ejecucion-workflow')
vi.mock('sonner', () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }))

const mockedListar = vi.mocked(listarEjecucionesWorkflow)
const mockedObtener = vi.mocked(obtenerEjecucionWorkflow)
const mockedReintentar = vi.mocked(reintentarEjecucionWorkflow)
const mockedAprobar = vi.mocked(aprobarEjecucionWorkflow)
const mockedRechazar = vi.mocked(rechazarEjecucionWorkflow)

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
  aprobable: false,
  resumen_evento: [],
  recargo_estimado: null,
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
      nombre_google: null,
      avatar_url: null,
      persona_nombre: null,
      persona_apellido: null,
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
  mockedObtener.mockRejectedValue(new Error('sin detalle en este test'))
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

    await elegirAccion(/Ver detalle/)

    expect(await screen.findByRole('dialog')).toHaveTextContent('La acción no pudo completarse.')
  })

  it.each([
    ['exitoso', 'success'],
    ['pendiente', 'info'],
    ['fallido', 'error'],
  ] as const)('reintento con respuesta %s avisa con toast.%s y recarga', async (estado, tipo) => {
    mockedReintentar.mockResolvedValue({ ...reintentable, id: 'ej-2', intento: 2, estado })
    renderPagina()

    await elegirAccion(/Reintentar/)

    await waitFor(() => expect(toast[tipo]).toHaveBeenCalledTimes(1))
    expect(mockedReintentar).toHaveBeenCalledWith('ej-1')
    await waitFor(() => expect(mockedListar).toHaveBeenCalledTimes(2))
  })

  it('muestra el detalle del 409 y recarga', async () => {
    mockedReintentar.mockRejectedValue(new ApiError(409, 'La regla fue modificada.'))
    renderPagina()

    await elegirAccion(/Reintentar/)

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('La regla fue modificada.'))
    await waitFor(() => expect(mockedListar).toHaveBeenCalledTimes(2))
  })

  it('ignora un segundo clic mientras el POST sigue pendiente', async () => {
    let resolver: (valor: EjecucionWorkflow) => void = () => {}
    mockedReintentar.mockReturnValue(new Promise((resolve) => (resolver = resolve)))
    renderPagina()

    await elegirAccion(/Reintentar/)
    await elegirAccion(/Reintentar/)

    expect(mockedReintentar).toHaveBeenCalledTimes(1)
    resolver({ ...reintentable, intento: 2 })
    await waitFor(() => expect(mockedListar).toHaveBeenCalledTimes(2))
  })

  describe('aprobación', () => {
    const pendiente: EjecucionWorkflow = {
      ...ejecucionFallida,
      estado: 'pendiente',
      error_detail: null,
      aprobable: true,
    }

    beforeEach(() => {
      mockedListar.mockResolvedValue({ ...listado, items: [pendiente] })
    })

    it('el filtro de estado ofrece "Pendientes de aprobación" y manda el estado pendiente', async () => {
      renderPagina()
      await screen.findByText('Aviso de mora')

      await elegirEstado('Pendientes de aprobación')

      await waitFor(() =>
        expect(mockedListar.mock.lastCall?.[0]).toMatchObject({ estado: 'pendiente', pagina: 1 }),
      )
    })

    it('aprueba desde la tabla, avisa y recarga', async () => {
      mockedAprobar.mockResolvedValue({ ...pendiente, estado: 'exitoso', aprobable: false })
      renderPagina()

      await elegirAccion(/Aprobar/)

      await waitFor(() => expect(mockedAprobar).toHaveBeenCalledWith('ej-1'))
      expect(toast.success).toHaveBeenCalledWith('La ejecución se aprobó y se completó.')
      await waitFor(() => expect(mockedListar).toHaveBeenCalledTimes(2))
    })

    it('si al aprobar la acción falla lo avisa como error', async () => {
      mockedAprobar.mockResolvedValue({ ...pendiente, estado: 'fallido', aprobable: false })
      renderPagina()

      await elegirAccion(/Aprobar/)

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith('La ejecución se aprobó, pero la acción falló.'),
      )
    })

    it('muestra el motivo del backend si no se puede aprobar y recarga', async () => {
      mockedAprobar.mockRejectedValue(
        new ApiError(409, 'La regla cambió desde que quedó pendiente.'),
      )
      renderPagina()

      await elegirAccion(/Aprobar/)

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith('La regla cambió desde que quedó pendiente.'),
      )
      await waitFor(() => expect(mockedListar).toHaveBeenCalledTimes(2))
    })

    it('rechaza con el motivo, avisa y recarga', async () => {
      mockedRechazar.mockResolvedValue({ ...pendiente, estado: 'rechazado', aprobable: false })
      renderPagina()

      await elegirAccion(/Rechazar/)
      await userEvent.type(await screen.findByLabelText('Motivo'), '  Ya se resolvió  ')
      await userEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Rechazar' }),
      )

      await waitFor(() => expect(mockedRechazar).toHaveBeenCalledWith('ej-1', 'Ya se resolvió'))
      expect(toast.success).toHaveBeenCalledWith('La ejecución se rechazó.')
      await waitFor(() => expect(mockedListar).toHaveBeenCalledTimes(2))
    })

    it('no deja rechazar sin motivo', async () => {
      renderPagina()

      await elegirAccion(/Rechazar/)
      const dialogo = await screen.findByRole('dialog')
      await userEvent.type(within(dialogo).getByLabelText('Motivo'), '   ')

      expect(within(dialogo).getByRole('button', { name: 'Rechazar' })).toBeDisabled()
      expect(mockedRechazar).not.toHaveBeenCalled()
    })

    it('cancelar el rechazo no llama al backend', async () => {
      renderPagina()

      await elegirAccion(/Rechazar/)
      await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))

      expect(mockedRechazar).not.toHaveBeenCalled()
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('desde el detalle también se puede aprobar y el detalle muestra el resultado', async () => {
      mockedAprobar.mockResolvedValue({ ...pendiente, estado: 'exitoso', aprobable: false })
      renderPagina()

      await elegirAccion(/Ver detalle/)
      const detalle = await screen.findByRole('dialog')
      await userEvent.click(within(detalle).getByRole('button', { name: /Aprobar/ }))

      await waitFor(() => expect(mockedAprobar).toHaveBeenCalledWith('ej-1'))
      await waitFor(() =>
        expect(within(screen.getByRole('dialog')).getByText('Exitosa')).toBeInTheDocument(),
      )
      expect(
        within(screen.getByRole('dialog')).queryByRole('button', { name: /Aprobar/ }),
      ).not.toBeInTheDocument()
    })

    it('sin workflows.actualizar no ofrece aprobar ni rechazar', async () => {
      conPermisos(['workflows.leer'])
      renderPagina()

      await screen.findByText('Aviso de mora')
      await abrirMenuDeFila()
      expect(screen.queryByRole('menuitem', { name: /Aprobar|Rechazar/ })).not.toBeInTheDocument()
    })

    it('ignora un segundo clic mientras la decisión sigue pendiente', async () => {
      let resolver: (valor: EjecucionWorkflow) => void = () => {}
      mockedAprobar.mockReturnValue(new Promise((resolve) => (resolver = resolve)))
      renderPagina()

      await elegirAccion(/Aprobar/)
      await elegirAccion(/Aprobar/)

      expect(mockedAprobar).toHaveBeenCalledTimes(1)
      resolver({ ...pendiente, estado: 'exitoso', aprobable: false })
      await waitFor(() => expect(mockedListar).toHaveBeenCalledTimes(2))
    })
  })

  it('no ofrece el reintento sin workflows.actualizar', async () => {
    conPermisos(['workflows.leer'])
    renderPagina()

    await screen.findByText('Aviso de mora')
    await abrirMenuDeFila()
    expect(screen.queryByRole('menuitem', { name: /Reintentar/ })).not.toBeInTheDocument()
  })
})
