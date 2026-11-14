import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EVENTO_FACTURA, reglaDe } from '@/modules/workflows/__tests__/fabricas'
import { ReglasWorkflowPage } from '@/modules/workflows/pages/reglas-workflow-page'
import { useActividadWorkflows } from '@/modules/workflows/hooks/use-actividad-workflows'
import { useCatalogosWorkflow } from '@/modules/workflows/hooks/use-catalogos-workflow'
import { useEjecucionesWorkflow } from '@/modules/workflows/hooks/use-ejecuciones-workflow'
import { useReglasWorkflow } from '@/modules/workflows/hooks/use-reglas-workflow'
import { useResumenWorkflows } from '@/modules/workflows/hooks/use-resumen-workflows'
import { aprobarEjecucionWorkflow } from '@/modules/workflows/services/aprobar-ejecucion-workflow'
import type { EjecucionWorkflow, ResumenWorkflows } from '@/modules/workflows/types'
import { useAuthStore } from '@/store/auth-store'
import { PERMISO_WORKFLOWS_ACTUALIZAR, PERMISO_WORKFLOWS_CREAR } from '@/modules/auth/constants'

vi.mock('@/modules/workflows/hooks/use-actividad-workflows')
vi.mock('@/modules/workflows/hooks/use-catalogos-workflow')
vi.mock('@/modules/workflows/hooks/use-ejecuciones-workflow')
vi.mock('@/modules/workflows/hooks/use-reglas-workflow')
vi.mock('@/modules/workflows/hooks/use-resumen-workflows')
vi.mock('@/modules/workflows/services/aprobar-ejecucion-workflow')
// El gráfico necesita canvas, que jsdom no tiene.
vi.mock('@/modules/workflows/components/indicador-ejecuciones', () => ({
  IndicadorEjecuciones: () => <p>Indicador de ejecuciones</p>,
}))
vi.mock('@/modules/workflows/components/mapa-automatizaciones', () => ({
  default: () => <p>Mapa de automatizaciones cargado</p>,
}))

const resumen: ResumenWorkflows = {
  dias: 30,
  actual: { exitoso: 8, fallido: 2, pendiente: 1, rechazado: 0, total: 11 },
  anterior: { exitoso: 4, fallido: 1, pendiente: 0, rechazado: 0, total: 5 },
  serie_diaria: [],
  reglas: [
    {
      workflow_rule_id: 'r-1',
      ejecuciones: { exitoso: 8, fallido: 2, pendiente: 1, rechazado: 0, total: 11 },
      serie: [0, 1, 2],
      ultima_ejecucion: '2026-11-14T11:55:00Z',
      fallas_7_dias: 2,
      sin_disparos: false,
    },
  ],
  activas: 1,
  inactivas: 0,
  con_errores: 1,
}

const pendiente = {
  id: 'ej-1',
  estado: 'pendiente',
  aprobable: true,
  workflow_rule_id: 'r-1',
  workflow_rule_nombre: 'Aviso de mora',
  tipo_accion: 'aplicar_penalidad',
} as EjecucionWorkflow

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

function almacenamiento(falla = false): Storage {
  const valores = new Map<string, string>()
  const operar = <T,>(accion: () => T): T => {
    if (falla) throw new Error('bloqueado')
    return accion()
  }
  return {
    get length() {
      return valores.size
    },
    clear: () => operar(() => valores.clear()),
    getItem: (clave) => operar(() => valores.get(clave) ?? null),
    key: (indice) => operar(() => [...valores.keys()][indice] ?? null),
    removeItem: (clave) => operar(() => void valores.delete(clave)),
    setItem: (clave, valor) => operar(() => void valores.set(clave, String(valor))),
  }
}

function usarAlmacenamiento(storage: Storage) {
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage })
}

function renderizar() {
  return render(
    <MemoryRouter>
      <ReglasWorkflowPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  usarAlmacenamiento(almacenamiento())
  conPermisos(['workflows.leer', PERMISO_WORKFLOWS_CREAR, PERMISO_WORKFLOWS_ACTUALIZAR])
  vi.mocked(useReglasWorkflow).mockReturnValue({
    reglas: [reglaDe()],
    cargando: false,
    error: null,
    sinPermiso: false,
    recargar: vi.fn(),
  })
  vi.mocked(useCatalogosWorkflow).mockReturnValue({
    tiposEvento: [EVENTO_FACTURA],
    tiposAccion: [],
    cargando: false,
    error: null,
    recargar: vi.fn(),
  })
  vi.mocked(useResumenWorkflows).mockReturnValue({
    resumen,
    cargando: false,
    error: null,
    recargar: vi.fn(),
  })
  vi.mocked(useActividadWorkflows).mockReturnValue({
    ejecuciones: [],
    nuevas: new Set(),
    actualizadoEn: new Date('2026-11-14T12:00:00Z'),
    error: null,
    refrescar: vi.fn(),
  })
  vi.mocked(useEjecucionesWorkflow).mockReturnValue({
    datos: { items: [pendiente], total: 1, pagina: 1, tamanio_pagina: 5, total_paginas: 1 },
    cargando: false,
    error: null,
    sinPermiso: false,
    recargar: vi.fn(),
  })
})

describe('ReglasWorkflowPage', () => {
  it('muestra las reglas en tarjetas por defecto, con su frase y sus ejecuciones', () => {
    renderizar()

    expect(screen.getByRole('link', { name: 'Aviso de mora' })).toHaveAttribute(
      'href',
      '/workflows/reglas/r-1',
    )
    expect(screen.getByText(/Cuando vence una factura: alerta interna\./)).toBeInTheDocument()
    expect(screen.getByText(/en 30 días/)).toBeInTheDocument()
  })

  it('pasar a la tabla recuerda la vista en este navegador', async () => {
    const user = userEvent.setup()
    renderizar()

    await user.click(screen.getByRole('radio', { name: 'Tabla' }))

    expect(screen.getByRole('columnheader', { name: 'Regla' })).toBeInTheDocument()
    expect(window.localStorage.getItem('workflows.reglas.vista')).toBe('tabla')
  })

  it('arranca con la vista que quedó guardada', () => {
    window.localStorage.setItem('workflows.reglas.vista', 'tabla')

    renderizar()

    expect(screen.getByRole('columnheader', { name: 'Regla' })).toBeInTheDocument()
  })

  it('el mapa se carga solo al elegir esa vista', async () => {
    const user = userEvent.setup()
    renderizar()
    expect(screen.queryByText('Mapa de automatizaciones cargado')).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Mapa de automatizaciones' }))

    expect(await screen.findByText('Mapa de automatizaciones cargado')).toBeInTheDocument()
  })

  it('funciona aunque el navegador no deje usar el almacenamiento', async () => {
    const user = userEvent.setup()
    usarAlmacenamiento(almacenamiento(true))
    renderizar()

    await user.click(screen.getByRole('radio', { name: 'Tabla' }))

    expect(screen.getByRole('columnheader', { name: 'Regla' })).toBeInTheDocument()
  })

  it('"Requiere tu atención" lista la aprobación pendiente y la regla con fallas', () => {
    renderizar()

    expect(screen.getByRole('heading', { name: 'Requiere tu atención' })).toBeInTheDocument()
    expect(screen.getByText('Aprobaciones pendientes')).toBeInTheDocument()
    expect(screen.getByText('2 fallas en los últimos 7 días')).toBeInTheDocument()
  })

  it('aprueba una ejecución pendiente sin salir de la página', async () => {
    const user = userEvent.setup()
    vi.mocked(aprobarEjecucionWorkflow).mockResolvedValue({
      ...pendiente,
      estado: 'exitoso',
    })
    renderizar()

    await user.click(screen.getByRole('button', { name: 'Aprobar' }))

    await waitFor(() => expect(aprobarEjecucionWorkflow).toHaveBeenCalledWith('ej-1'))
  })

  it('sin permiso de actualizar no ofrece aprobar ni activar', () => {
    conPermisos(['workflows.leer'])

    renderizar()

    expect(screen.queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Desactivar Aviso de mora' })).toBeDisabled()
    expect(screen.queryByRole('link', { name: 'Nueva regla' })).not.toBeInTheDocument()
  })

  it('sin reglas ofrece crear la primera', () => {
    vi.mocked(useReglasWorkflow).mockReturnValue({
      reglas: [],
      cargando: false,
      error: null,
      sinPermiso: false,
      recargar: vi.fn(),
    })

    renderizar()

    expect(screen.getByText('Todavía no hay reglas de automatización.')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Nueva regla' })).not.toHaveLength(0)
  })
})
