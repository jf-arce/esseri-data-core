import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { ProtectedRoute } from '@/router/protected-route'
import { useAuthStore } from '@/store/auth-store'

function renderConEstado() {
  return render(
    <MemoryRouter initialEntries={['/privado']}>
      <Routes>
        <Route path="/login" element={<p>Login</p>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/privado" element={<p>Privado</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useAuthStore.setState({ usuario: null, status: 'idle' })
})

describe('ProtectedRoute', () => {
  it('no renderiza nada mientras la sesión está en loading', () => {
    useAuthStore.setState({ status: 'loading' })
    renderConEstado()

    expect(screen.queryByText('Privado')).not.toBeInTheDocument()
    expect(screen.queryByText('Login')).not.toBeInTheDocument()
  })

  it('redirige a /login si no hay sesión', () => {
    useAuthStore.setState({ status: 'unauthenticated' })
    renderConEstado()

    expect(screen.getByText('Login')).toBeInTheDocument()
  })

  it('renderiza la ruta si hay sesión', () => {
    useAuthStore.setState({ status: 'authenticated' })
    renderConEstado()

    expect(screen.getByText('Privado')).toBeInTheDocument()
  })
})
