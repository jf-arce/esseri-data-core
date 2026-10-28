import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { NoEncontradaPage } from '@/pages/no-encontrada-page'
import { VistaRoute } from '@/router/vista-route'
import { useAuthStore } from '@/store/auth-store'

// Mismo esquema que `AppRouter`: una ruta por vista y el comodín afuera de `VistaRoute`.
function renderEn(ruta: string, rolActivo: string) {
  useAuthStore.setState({ rolActivo })
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route element={<VistaRoute vista="consola" />}>
          <Route path="/panel" element={<p>Panel de consola</p>} />
        </Route>
        <Route element={<VistaRoute vista="docente" />}>
          <Route path="/docente" element={<p>Inicio docente</p>} />
        </Route>
        <Route element={<VistaRoute vista="familia" />}>
          <Route path="/familia" element={<p>Inicio familia</p>} />
        </Route>
        <Route path="*" element={<NoEncontradaPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useAuthStore.setState({ usuario: null, rolActivo: null })
})

describe('NoEncontradaPage', () => {
  it.each([
    ['docente', '/docente'],
    ['familia', '/familia'],
    ['dirección', '/'],
  ])('con el rol %s muestra el aviso y vuelve a su inicio (%s)', (rol, inicio) => {
    renderEn('/ruta/que/no/existe', rol)

    expect(screen.getByText('No encontramos esta página')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', inicio)
  })

  it('no pisa una ruta válida de la vista del rol', () => {
    renderEn('/docente', 'docente')

    expect(screen.getByText('Inicio docente')).toBeInTheDocument()
    expect(screen.queryByText('No encontramos esta página')).not.toBeInTheDocument()
  })

  it('una ruta válida de otra vista sigue redirigiendo al inicio del rol, sin aviso', () => {
    renderEn('/panel', 'familia')

    expect(screen.getByText('Inicio familia')).toBeInTheDocument()
    expect(screen.queryByText('No encontramos esta página')).not.toBeInTheDocument()
  })
})
