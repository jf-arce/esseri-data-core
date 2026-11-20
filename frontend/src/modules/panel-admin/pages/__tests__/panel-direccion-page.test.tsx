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
  ] as string[],
  justificaciones: { datos: { total: 0 }, cargando: false, error: null },
  workflows: { datos: { actual: { fallido: 0 } }, cargando: false, error: null },
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
      tareas_pendientes: 2,
      tareas_escaladas: 1,
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
vi.mock('@/modules/panel-admin/hooks/use-atencion-institucional', () => ({
  useAtencionInstitucional: () => ({
    justificaciones: state.justificaciones,
    workflows: state.workflows,
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
  state.justificaciones = { datos: { total: 0 }, cargando: false, error: null }
  state.workflows = { datos: { actual: { fallido: 0 } }, cargando: false, error: null }
})

it('preserves KPI navigation and adds the approved dashboard sections without sample data', () => {
  state.permisos = [...state.permisos, 'proveedores_compras.actualizar', 'facturacion.actualizar']
  render(
    <MemoryRouter>
      <PanelDireccionPage />
    </MemoryRouter>,
  )
  expect(screen.getByRole('link', { name: 'Ver alumnos activos' })).toHaveAttribute(
    'href',
    '/familias-alumnos/alumnos',
  )
  expect(screen.queryByRole('heading', { name: 'Requiere tu atención' })).not.toBeInTheDocument()
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

it('leads with pending debt and gives every indicator real context', () => {
  render(
    <MemoryRouter>
      <PanelDireccionPage />
    </MemoryRouter>,
  )
  const hero = screen.getByRole('link', { name: 'Ver facturas y deuda pendiente' })
  expect(hero).toHaveTextContent('Deuda pendiente')
  expect(hero).toHaveTextContent(/Vencida.*\$\s*40(?!,)/)
  expect(hero).toHaveTextContent(/Familias en mora.*3/)
  expect(screen.getByText('+2 nuevas · 1 baja este mes')).toBeInTheDocument()
  expect(screen.getByText('Sin registros cargados hoy')).toBeInTheDocument()
  expect(screen.getByText('Ninguna pendiente')).toBeInTheDocument()
})

it('shows pending and escalated tasks when the role can read workflows', () => {
  state.permisos = [...state.permisos, 'workflows.leer']
  render(
    <MemoryRouter>
      <PanelDireccionPage />
    </MemoryRouter>,
  )
  const tareas = screen.getByRole('link', { name: 'Ver tareas pendientes y escaladas' })
  expect(tareas).toHaveAttribute('href', '/workflows/tareas')
  expect(tareas).toHaveTextContent('3')
  expect(tareas).toHaveTextContent('2 pendientes · 1 escaladas')
})

it('hides the task indicator without workflows permission', () => {
  render(
    <MemoryRouter>
      <PanelDireccionPage />
    </MemoryRouter>,
  )
  expect(
    screen.queryByRole('link', { name: 'Ver tareas pendientes y escaladas' }),
  ).not.toBeInTheDocument()
})

it('lists workflow errors as a review situation and links to the filtered executions', () => {
  state.permisos = [...state.permisos, 'workflows.leer']
  state.workflows = { datos: { actual: { fallido: 2 } }, cargando: false, error: null }
  render(
    <MemoryRouter>
      <PanelDireccionPage />
    </MemoryRouter>,
  )
  expect(screen.getByRole('region', { name: 'Situaciones para revisar' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Ver ejecuciones' })).toHaveAttribute(
    'href',
    '/workflows/ejecuciones?estado=fallido',
  )
  expect(screen.getByText('2')).toBeInTheDocument()
})

it('never shows the operational queues: they live in the Panel Administrativo', () => {
  state.permisos = [
    ...state.permisos,
    'proveedores_compras.actualizar',
    'facturacion.actualizar',
    'academico.actualizar:justificaciones',
    'workflows.leer',
  ]
  state.justificaciones = { datos: { total: 4 }, cargando: false, error: null }
  render(
    <MemoryRouter>
      <PanelDireccionPage />
    </MemoryRouter>,
  )
  expect(screen.queryByRole('heading', { name: 'Requiere tu atención' })).not.toBeInTheDocument()
  expect(screen.queryByText('Justificaciones pendientes')).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Actividad reciente' })).toBeInTheDocument()
})

it('hides review situations the role cannot open', () => {
  render(
    <MemoryRouter>
      <PanelDireccionPage />
    </MemoryRouter>,
  )
  expect(screen.queryByRole('region', { name: 'Situaciones para revisar' })).not.toBeInTheDocument()
})

it('promotes active students to the hero when the role cannot see billing', () => {
  state.permisos = ['familias_alumnos.leer']
  render(
    <MemoryRouter>
      <PanelDireccionPage />
    </MemoryRouter>,
  )
  expect(screen.queryByRole('link', { name: 'Ver facturas y deuda pendiente' })).toBeNull()
  expect(screen.getByRole('link', { name: 'Ver alumnos activos' })).toHaveTextContent('26')
  expect(screen.queryByText(/Vencida/)).not.toBeInTheDocument()
})
