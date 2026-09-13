import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { RoleRoute } from '@/router/role-route'
import { useAuthStore } from '@/store/auth-store'

function renderConRolActivo(roles: string[], rolActivo: string | null) {
  useAuthStore.setState({
    usuario: {
      id: 'u1',
      email: 'a@esseri.edu.ar',
      auth_provider: 'local',
      estado: 'activo',
      roles,
      permisos: [],
      perfiles: roles.map((nombre) => ({ id: nombre, nombre, descripcion: null, permisos: [] })),
    },
    status: 'authenticated',
    rolActivo,
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
  useAuthStore.setState({ usuario: null, status: 'idle', rolActivo: null })
})

describe('RoleRoute', () => {
  it('redirige a / si el rol activo no está entre los permitidos', () => {
    renderConRolActivo(['docente'], 'docente')

    expect(screen.getByText('Home')).toBeInTheDocument()
  })

  it('renderiza la ruta si el rol activo está entre los permitidos', () => {
    renderConRolActivo(['docente', 'administrador_del_sistema'], 'administrador_del_sistema')

    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('redirige a / si la cuenta tiene el rol permitido pero no es el rol activo', () => {
    // Regresión del bug original: dos roles en la misma cuenta no deben mostrar dos vistas a
    // la vez — solo la del rol activo, aunque el otro también calificaría para esta ruta.
    renderConRolActivo(['docente', 'administrador_del_sistema'], 'docente')

    expect(screen.getByText('Home')).toBeInTheDocument()
  })
})
