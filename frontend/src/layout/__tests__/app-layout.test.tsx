import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { AppLayout } from '../app-layout'
import { useUiStore } from '@/store/ui-store'

vi.mock('@/layout/menu-cuenta', () => ({ MenuCuenta: () => null }))
vi.mock('@/layout/global-search-dialog', () => ({ GlobalSearchDialog: () => null }))
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }))
vi.mock('@/layout/nav-items', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/layout/nav-items')>()),
  filtrarNav: () => [
    {
      label: 'Gestión',
      items: [
        {
          label: 'Académico',
          href: '/academico',
          icon: () => <svg />,
          children: [{ label: 'Asistencia', href: '/academico/asistencia', icon: () => <svg /> }],
        },
        { label: 'Facturación', href: '/facturacion', icon: () => <svg /> },
      ],
    },
  ],
}))

beforeEach(() => useUiStore.setState({ sidebarOpen: true }))

it('preserves root module destinations in expanded navigation', () => {
  render(
    <MemoryRouter>
      <AppLayout />
    </MemoryRouter>,
  )

  expect(screen.getByRole('link', { name: 'Académico' })).toHaveAttribute('href', '/academico')
  expect(screen.getByRole('link', { name: 'Facturación' })).toHaveAttribute('href', '/facturacion')
})

it('collapses to an icon rail and restores labels without removing page controls', () => {
  const { container } = render(
    <MemoryRouter>
      <AppLayout />
    </MemoryRouter>,
  )
  const sidebar = container.querySelector('[data-slot="sidebar"]')!
  const toggle = screen.getByRole('button', { name: 'Mostrar u ocultar la navegación' })
  expect(sidebar).toHaveAttribute('data-state', 'expanded')
  expect(toggle.querySelector('.lucide-panel-left-close')).toBeInTheDocument()
  fireEvent.click(toggle)
  expect(sidebar).toHaveAttribute('data-state', 'collapsed')
  expect(sidebar).toHaveAttribute('data-collapsible', 'icon')
  expect(toggle).toBeInTheDocument()
  expect(toggle.querySelector('.lucide-panel-left-open')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Buscar o ir a/ })).toBeInTheDocument()
  fireEvent.click(toggle)
  expect(sidebar).toHaveAttribute('data-state', 'expanded')
  expect(useUiStore.getState().sidebarOpen).toBe(true)
})

it('shows every permitted module in the collapsed rail even inside a module section', () => {
  render(
    <MemoryRouter initialEntries={['/academico/asistencia']}>
      <AppLayout />
    </MemoryRouter>,
  )
  expect(screen.queryByRole('link', { name: 'Facturación' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Mostrar u ocultar la navegación' }))
  expect(screen.getByRole('link', { name: 'Facturación' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Académico' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Mostrar u ocultar la navegación' }))
  expect(screen.getByRole('link', { name: 'Asistencia' })).toBeInTheDocument()
})

it('preserves the existing keyboard shortcut for hiding and restoring navigation', () => {
  const { container } = render(
    <MemoryRouter>
      <AppLayout />
    </MemoryRouter>,
  )
  const sidebar = container.querySelector('[data-slot="sidebar"]')!
  fireEvent.keyDown(window, { key: 'b', ctrlKey: true })
  expect(sidebar).toHaveAttribute('data-collapsible', 'icon')
  fireEvent.keyDown(window, { key: 'b', ctrlKey: true })
  expect(sidebar).toHaveAttribute('data-state', 'expanded')
})

it('opens submodule icons directly below their module while keeping the rail collapsed', () => {
  useUiStore.setState({ sidebarOpen: false })
  const { container } = render(
    <MemoryRouter>
      <AppLayout />
    </MemoryRouter>,
  )
  const modulo = screen.getByRole('link', { name: 'Académico' })
  expect(screen.queryByRole('link', { name: 'Asistencia' })).not.toBeInTheDocument()
  fireEvent.click(modulo)
  const submodulo = within(modulo.closest('li')!).getByRole('link', { name: 'Asistencia' })
  expect(submodulo).toHaveAttribute('href', '/academico/asistencia')
  expect(modulo.compareDocumentPosition(submodulo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Facturación' })).toBeInTheDocument()
  fireEvent.click(submodulo)
  expect(container.querySelector('[data-slot="sidebar"]')).toHaveAttribute(
    'data-collapsible',
    'icon',
  )
  expect(screen.getByRole('link', { name: 'Asistencia' })).toBeInTheDocument()
  expect(useUiStore.getState().sidebarOpen).toBe(false)
})
