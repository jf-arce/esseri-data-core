import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { PanelAdministracionPage } from '../panel-administracion-page'

const state = vi.hoisted(() => ({
  cargando: false,
  error: null as string | null,
  datos: {
    facturas_vencidas: 7 as number | null,
    cobrado_mes: '125000.00' as string | null,
    solicitudes_compra_pendientes: 3 as number | null,
  },
  justificaciones: { datos: { total: 4 }, cargando: false, error: null } as {
    datos: { total: number }
    cargando: boolean
    error: string | null
  },
  permisos: [
    'familias_alumnos.leer',
    'facturacion.leer',
    'proveedores_compras.leer',
    'inscripciones.leer',
  ] as string[],
}))

vi.mock('@/modules/panel-admin/hooks/use-indicadores-administracion', () => ({
  useIndicadoresAdministracion: () => ({
    datos: state.datos,
    cargando: state.cargando,
    error: state.error,
  }),
}))
vi.mock('@/modules/panel-admin/hooks/use-detalle-direccion', () => ({
  useDetalleDireccion: () => ({
    compras: { datos: [], error: null, cargando: false },
    deudas: { datos: { items: [], total: 0 }, error: null, cargando: false },
    asistencia: { datos: null, error: null, cargando: false },
    finanzas: { datos: null, error: null, cargando: false },
    actividad: { datos: [], error: null, cargando: false },
  }),
}))
vi.mock('@/modules/panel-admin/hooks/use-atencion-institucional', () => ({
  useAtencionInstitucional: () => ({
    justificaciones: state.justificaciones,
    workflows: { datos: null, cargando: false, error: null },
  }),
}))
vi.mock('@/store/auth-store', () => ({
  permisosActivos: vi.fn(),
  useAuthStore: () => state.permisos.map((codigo) => ({ codigo })),
}))

beforeEach(() => {
  state.cargando = false
  state.error = null
  state.datos = {
    facturas_vencidas: 7,
    cobrado_mes: '125000.00',
    solicitudes_compra_pendientes: 3,
  }
  state.justificaciones = { datos: { total: 4 }, cargando: false, error: null }
  state.permisos = [
    'familias_alumnos.leer',
    'facturacion.leer',
    'proveedores_compras.leer',
    'inscripciones.leer',
  ]
})

it('shows the three operational indicators with their modules', () => {
  render(
    <MemoryRouter>
      <PanelAdministracionPage />
    </MemoryRouter>,
  )
  const vencidas = screen.getByRole('link', { name: 'Ver facturas vencidas' })
  expect(vencidas).toHaveAttribute('href', '/facturacion')
  expect(vencidas).toHaveTextContent('7')
  const cobrado = screen.getByRole('link', { name: 'Ver cobranzas del mes' })
  expect(cobrado).toHaveAttribute('href', '/facturacion')
  expect(cobrado).toHaveTextContent(/125\.000,00/)
  const compras = screen.getByRole('link', { name: 'Ver solicitudes de compra pendientes' })
  expect(compras).toHaveAttribute('href', '/solicitudes-compra?estado=pendiente')
  expect(compras).toHaveTextContent('3')
})

it('does not repeat the sidebar modules as quick access cards', () => {
  render(
    <MemoryRouter>
      <PanelAdministracionPage />
    </MemoryRouter>,
  )
  expect(screen.getByRole('heading', { name: 'Panel Administrativo' })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Accesos rápidos' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Inscripciones' })).not.toBeInTheDocument()
})

it('adds the shared operational blocks', () => {
  render(
    <MemoryRouter>
      <PanelAdministracionPage />
    </MemoryRouter>,
  )
  expect(screen.getByRole('heading', { name: 'Requiere tu atención' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Actividad reciente' })).toBeInTheDocument()
})

it('shows pending justifications only when Administración can resolve them', () => {
  render(
    <MemoryRouter>
      <PanelAdministracionPage />
    </MemoryRouter>,
  )
  expect(screen.queryByText('Justificaciones pendientes')).not.toBeInTheDocument()

  state.permisos = [...state.permisos, 'academico.actualizar:justificaciones']
  render(
    <MemoryRouter>
      <PanelAdministracionPage />
    </MemoryRouter>,
  )
  expect(screen.getByText('Justificaciones pendientes')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Abrir bandeja' })).toHaveAttribute(
    'href',
    '/academico/justificaciones',
  )
  expect(screen.getByText('4')).toBeInTheDocument()
})

it('hides a block the role cannot see', () => {
  state.datos = {
    facturas_vencidas: null,
    cobrado_mes: null,
    solicitudes_compra_pendientes: 3,
  }
  render(
    <MemoryRouter>
      <PanelAdministracionPage />
    </MemoryRouter>,
  )
  expect(screen.queryByRole('link', { name: 'Ver facturas vencidas' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Ver cobranzas del mes' })).not.toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: 'Ver solicitudes de compra pendientes' }),
  ).toBeInTheDocument()
})

it('does not present a failed request as zero', () => {
  state.error = 'Sin conexión'
  render(
    <MemoryRouter>
      <PanelAdministracionPage />
    </MemoryRouter>,
  )
  expect(screen.getByRole('link', { name: 'Ver facturas vencidas' })).toHaveTextContent(
    'No disponible',
  )
  expect(screen.getByRole('link', { name: 'Ver cobranzas del mes' })).toHaveTextContent(
    'No disponible',
  )
})

it('hides the attention queue without purchasing or billing permissions', () => {
  state.permisos = ['familias_alumnos.leer', 'inscripciones.leer']
  render(
    <MemoryRouter>
      <PanelAdministracionPage />
    </MemoryRouter>,
  )
  expect(screen.queryByRole('heading', { name: 'Requiere tu atención' })).not.toBeInTheDocument()
})
