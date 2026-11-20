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
  permisos: [
    'familias_alumnos.leer',
    'facturacion.leer',
    'proveedores_compras.leer',
    'inscripciones.leer',
  ],
}))

vi.mock('@/modules/panel-admin/hooks/use-indicadores-administracion', () => ({
  useIndicadoresAdministracion: () => ({
    datos: state.datos,
    cargando: state.cargando,
    error: state.error,
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
  expect(compras).toHaveAttribute('href', '/solicitudes-compra')
  expect(compras).toHaveTextContent('3')
})

it('keeps the quick access cards', () => {
  render(
    <MemoryRouter>
      <PanelAdministracionPage />
    </MemoryRouter>,
  )
  expect(screen.getByRole('heading', { name: 'Panel Administrativo' })).toBeInTheDocument()
  for (const titulo of ['Familias', 'Facturación', 'Proveedores', 'Inscripciones', 'Compras']) {
    expect(screen.getByText(titulo)).toBeInTheDocument()
  }
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
