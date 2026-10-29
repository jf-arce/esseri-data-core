import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { RolActivoRoute } from '@/router/rol-activo-route'
import { useAuthStore } from '@/store/auth-store'

function renderConRolActivo(rolActivo: string | null) {
  useAuthStore.setState({ rolActivo })

  return render(
    <MemoryRouter initialEntries={['/panel']}>
      <Routes>
        <Route path="/elegir-perfil" element={<p>Elegir perfil</p>} />
        <Route element={<RolActivoRoute />}>
          <Route path="/panel" element={<p>Panel</p>} />
          <Route path="/workflows/ejecuciones" element={<p>Ejecuciones</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  sessionStorage.clear()
  useAuthStore.setState({ rolActivo: null })
})

describe('RolActivoRoute', () => {
  it('sin rol activo, redirige a /elegir-perfil', () => {
    renderConRolActivo(null)

    expect(screen.getByText('Elegir perfil')).toBeInTheDocument()
  })

  it('con rol activo, deja pasar a la ruta', () => {
    renderConRolActivo('dirección')

    expect(screen.getByText('Panel')).toBeInTheDocument()
  })

  it('con un destino guardado, lleva a esa pantalla y lo borra', async () => {
    sessionStorage.setItem('esseri:destino', '/workflows/ejecuciones')
    renderConRolActivo('dirección')

    expect(await screen.findByText('Ejecuciones')).toBeInTheDocument()
    expect(sessionStorage.getItem('esseri:destino')).toBeNull()
  })

  it('ignora un destino externo', () => {
    sessionStorage.setItem('esseri:destino', '//evil.com')
    renderConRolActivo('dirección')

    expect(screen.getByText('Panel')).toBeInTheDocument()
  })

  it('sin rol activo conserva el destino hasta que se elija el perfil', () => {
    sessionStorage.setItem('esseri:destino', '/workflows/ejecuciones')
    renderConRolActivo(null)

    expect(screen.getByText('Elegir perfil')).toBeInTheDocument()
    expect(sessionStorage.getItem('esseri:destino')).toBe('/workflows/ejecuciones')
  })
})
