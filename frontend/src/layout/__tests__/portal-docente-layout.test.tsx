import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { PortalDocenteLayout } from '@/layout/portal-docente-layout'

vi.mock('@/layout/menu-cuenta', () => ({
  MenuCuenta: () => <button type="button">Cuenta</button>,
}))

describe('PortalDocenteLayout', () => {
  it('muestra los cinco destinos docentes y marca el seguimiento del curso como activo', () => {
    render(
      <MemoryRouter initialEntries={['/docente/cursos/division-1/seguimiento']}>
        <Routes>
          <Route path="/docente/cursos/:divisionId/seguimiento" element={<PortalDocenteLayout />}>
            <Route index element={<p>Indicadores de asistencia</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Indicadores de asistencia')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Inicio' })).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'Mis cursos' })).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'Asistencia' })).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'Alumnos' })).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'Comunicaciones' })).toHaveLength(2)
    expect(
      screen
        .getAllByRole('link', { name: 'Seguimiento' })
        .every((link) => link.getAttribute('aria-current') === 'page'),
    ).toBe(true)
  })
})
