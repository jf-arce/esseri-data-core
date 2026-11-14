import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { PanelDireccionPage } from '../panel-direccion-page'

const state = vi.hoisted(() => ({
  error: null as string | null,
  cargando: false,
  permisos: [
    'familias_alumnos.leer',
    'facturacion.leer',
    'academico.leer',
    'proveedores_compras.leer',
  ],
}))
vi.mock('@/modules/panel-admin/hooks/use-indicadores-direccion', () => ({
  useIndicadoresDireccion: () => ({
    datos: {
      alumnos_activos: 26,
      deuda_pendiente_total: '100',
      inasistencias_hoy: 0,
      solicitudes_compra_pendientes: 0,
      deuda_vencida_total: '40',
      familias_en_mora: 3,
      altas_mes: 2,
      bajas_mes: 1,
      asistencias_registradas_hoy: 0,
      solicitud_pendiente_mas_antigua: null,
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
  useAuthStore: () => state.permisos.map((codigo) => ({ codigo })),
}))

beforeEach(() => {
  state.error = null
  state.cargando = false
  state.permisos = [
    'familias_alumnos.leer',
    'facturacion.leer',
    'academico.leer',
    'proveedores_compras.leer',
  ]
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
  expect(screen.getByRole('heading', { name: 'Asistencia · 30 días' })).toBeInTheDocument()
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

it('leads with overdue debt and gives every indicator real context', () => {
  render(
    <MemoryRouter>
      <PanelDireccionPage />
    </MemoryRouter>,
  )
  const hero = screen.getByRole('link', { name: 'Ver facturas y deuda vencida' })
  expect(hero).toHaveTextContent('Deuda vencida')
  expect(hero).toHaveTextContent(/Total pendiente.*100,00/)
  expect(hero).toHaveTextContent(/Familias en mora.*3/)
  expect(screen.getByText('+2 altas · 1 baja este mes')).toBeInTheDocument()
  expect(screen.getByText('Sin registros cargados hoy')).toBeInTheDocument()
  expect(screen.getByText('Ninguna pendiente')).toBeInTheDocument()
})

it('promotes active students to the hero when the role cannot see billing', () => {
  state.permisos = ['familias_alumnos.leer']
  render(
    <MemoryRouter>
      <PanelDireccionPage />
    </MemoryRouter>,
  )
  expect(screen.queryByRole('link', { name: 'Ver facturas y deuda vencida' })).toBeNull()
  expect(screen.getByRole('link', { name: 'Ver alumnos activos' })).toHaveTextContent('26')
  expect(screen.queryByText(/Total pendiente/)).not.toBeInTheDocument()
})
