import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { PermisoRoute } from '@/router/permiso-route'
import { useAuthStore } from '@/store/auth-store'

function renderConPermisos(permisos: { codigo: string }[]) {
  useAuthStore.setState({
    usuario: {
      id: 'u1',
      email: 'a@esseri.edu.ar',
      auth_provider: 'local',
      estado: 'activo',
      roles: ['administrador del sistema'],
      permisos: permisos.map((p, i) => ({
        id: `p${i}`,
        modulo: 'Autenticación',
        accion: 'leer',
        tipo_informacion: null,
        ...p,
      })),
    },
    status: 'authenticated',
  })

  return render(
    <MemoryRouter initialEntries={['/configuracion/acceso']}>
      <Routes>
        <Route element={<PermisoRoute codigo="autenticacion.leer" label="Autenticación · Leer" />}>
          <Route path="/configuracion/acceso" element={<p>Acceso</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useAuthStore.setState({ usuario: null, status: 'idle' })
})

describe('PermisoRoute', () => {
  it('muestra la pantalla sin permiso cuando el usuario no tiene el código', () => {
    renderConPermisos([{ codigo: 'facturacion.leer' }])

    expect(screen.getByText('No tenés acceso a esta sección')).toBeInTheDocument()
    expect(screen.getByText('Autenticación · Leer')).toBeInTheDocument()
    expect(screen.queryByText('Acceso')).not.toBeInTheDocument()
  })

  it('renderiza la ruta cuando el usuario tiene el código exacto', () => {
    renderConPermisos([{ codigo: 'autenticacion.leer' }])

    expect(screen.getByText('Acceso')).toBeInTheDocument()
  })

  it('un permiso amplio sin tipo_informacion satisface un pedido con tipo', () => {
    useAuthStore.setState({
      usuario: {
        id: 'u1',
        email: 'a@esseri.edu.ar',
        auth_provider: 'local',
        estado: 'activo',
        roles: [],
        permisos: [
          {
            id: 'p1',
            codigo: 'academico.leer',
            modulo: 'Académico',
            accion: 'leer',
            tipo_informacion: null,
          },
        ],
      },
      status: 'authenticated',
    })

    render(
      <MemoryRouter initialEntries={['/x']}>
        <Routes>
          <Route element={<PermisoRoute codigo="academico.leer:datos_medicos" label="Académico" />}>
            <Route path="/x" element={<p>Académico</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Académico')).toBeInTheDocument()
  })
})
