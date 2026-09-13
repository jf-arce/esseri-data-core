import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { PermisoRoute } from '@/router/permiso-route'
import { useAuthStore } from '@/store/auth-store'

const ROL_DE_PRUEBA = 'administrador del sistema'

function renderConPermisos(permisos: { codigo: string }[]) {
  const permisosCompletos = permisos.map((p, i) => ({
    id: `p${i}`,
    modulo: 'Autenticación',
    accion: 'leer',
    tipo_informacion: null,
    ...p,
  }))

  useAuthStore.setState({
    usuario: {
      id: 'u1',
      email: 'a@esseri.edu.ar',
      auth_provider: 'local',
      estado: 'activo',
      roles: [ROL_DE_PRUEBA],
      permisos: permisosCompletos,
      perfiles: [
        {
          id: ROL_DE_PRUEBA,
          nombre: ROL_DE_PRUEBA,
          descripcion: null,
          permisos: permisosCompletos,
        },
      ],
    },
    status: 'authenticated',
    rolActivo: ROL_DE_PRUEBA,
  })

  return render(
    <MemoryRouter initialEntries={['/usuarios-roles']}>
      <Routes>
        <Route element={<PermisoRoute codigo="autenticacion.leer" label="Autenticación · Leer" />}>
          <Route path="/usuarios-roles" element={<p>Acceso</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useAuthStore.setState({ usuario: null, status: 'idle', rolActivo: null })
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
    const rol = 'bienestar/orientación'
    const permisos = [
      {
        id: 'p1',
        codigo: 'academico.leer',
        modulo: 'Académico',
        accion: 'leer',
        tipo_informacion: null,
      },
    ]
    useAuthStore.setState({
      usuario: {
        id: 'u1',
        email: 'a@esseri.edu.ar',
        auth_provider: 'local',
        estado: 'activo',
        roles: [rol],
        permisos,
        perfiles: [{ id: rol, nombre: rol, descripcion: null, permisos }],
      },
      status: 'authenticated',
      rolActivo: rol,
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

  it('sin rol activo (cuenta con más de un rol, todavía sin elegir) no ve el módulo', () => {
    // El usuario tiene el permiso en algún perfil, pero como todavía no eligió con qué rol
    // entrar (`rolActivo` null), `permisosActivos` no debe filtrar por la suma de la cuenta.
    const permisos = [
      {
        id: 'p1',
        codigo: 'autenticacion.leer',
        modulo: 'Autenticación',
        accion: 'leer',
        tipo_informacion: null,
      },
    ]
    useAuthStore.setState({
      usuario: {
        id: 'u1',
        email: 'a@esseri.edu.ar',
        auth_provider: 'local',
        estado: 'activo',
        roles: [ROL_DE_PRUEBA],
        permisos,
        perfiles: [{ id: ROL_DE_PRUEBA, nombre: ROL_DE_PRUEBA, descripcion: null, permisos }],
      },
      status: 'authenticated',
      rolActivo: null,
    })

    render(
      <MemoryRouter initialEntries={['/usuarios-roles']}>
        <Routes>
          <Route
            element={<PermisoRoute codigo="autenticacion.leer" label="Autenticación · Leer" />}
          >
            <Route path="/usuarios-roles" element={<p>Acceso</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('No tenés acceso a esta sección')).toBeInTheDocument()
  })
})
