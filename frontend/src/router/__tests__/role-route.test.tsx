import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { RoleRoute } from '@/router/role-route'
import { useAuthStore } from '@/store/auth-store'

function renderConRoles(roles: string[]) {
  useAuthStore.setState({
    usuario: {
      id: 'u1',
      email: 'a@esseri.edu.ar',
      auth_provider: 'local',
      estado: 'activo',
      roles,
    },
    status: 'authenticated',
  })

  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/" element={<p>Home</p>} />
        <Route element={<RoleRoute allowedRoles={['administrador_del_sistema']} />}>
          <Route path="/admin" element={<p>Admin</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useAuthStore.setState({ usuario: null, status: 'idle' })
})

describe('RoleRoute', () => {
  it('redirige a / si el usuario no tiene ninguno de los roles permitidos', () => {
    renderConRoles(['docente'])

    expect(screen.getByText('Home')).toBeInTheDocument()
  })

  it('renderiza la ruta si el usuario tiene alguno de los roles permitidos', () => {
    renderConRoles(['docente', 'administrador_del_sistema'])

    expect(screen.getByText('Admin')).toBeInTheDocument()
  })
})
