import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { PanelDireccionPage } from '../panel-direccion-page'

const state = vi.hoisted(() => ({ error: null as string | null, cargando: false }))
vi.mock('@/modules/panel-admin/hooks/use-indicadores-direccion', () => ({
  useIndicadoresDireccion: () => ({
    datos: {
      alumnos_activos: 26,
      deuda_pendiente_total: '100',
      inasistencias_hoy: 0,
      solicitudes_compra_pendientes: 0,
    },
    ...state,
  }),
}))
vi.mock('@/modules/panel-admin/hooks/use-detalle-direccion', () => ({
  useDetalleDireccion: () => ({
    compras: { datos: [], error: null, cargando: false },
    deudas: { datos: { items: [], total: 0 }, error: null, cargando: false },
    asistencia: { datos: [], error: null, cargando: false },
    finanzas: { datos: [], error: null, cargando: false },
    actividad: { datos: [], error: null, cargando: false },
  }),
}))
vi.mock('@/store/auth-store', () => ({
  permisosActivos: vi.fn(),
  useAuthStore: () =>
    ['familias_alumnos.leer', 'facturacion.leer', 'academico.leer', 'proveedores_compras.leer'].map(
      (codigo) => ({ codigo }),
    ),
}))

beforeEach(() => {
  state.error = null
  state.cargando = false
})

it('preserves KPI navigation and adds the approved dashboard sections without sample data', () => {
  render(
    <MemoryRouter>
      <PanelDireccionPage />
    </MemoryRouter>,
  )
  expect(screen.getByRole('link', { name: 'Ver alumnos activos' })).toHaveAttribute(
    'href',
    '/familias-alumnos/alumnos',
  )
  expect(screen.getByRole('heading', { name: 'Requiere tu atención' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Evolución financiera' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Asistencia' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Actividad reciente' })).toBeInTheDocument()
  expect(screen.queryByText('Datos de ejemplo')).not.toBeInTheDocument()
})

it('does not present failed KPI requests as zero values', () => {
  state.error = 'Sin conexión'
  render(
    <MemoryRouter>
      <PanelDireccionPage />
    </MemoryRouter>,
  )
  expect(screen.getByText('Sin conexión')).toBeInTheDocument()
  expect(screen.queryByText('26')).not.toBeInTheDocument()
})
