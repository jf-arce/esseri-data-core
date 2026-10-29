import { render, screen } from '@testing-library/react'
import { MemoryRouter, useRoutes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { academicoRoutes } from '@/modules/academico/routes'
import { useAuthStore } from '@/store/auth-store'

vi.mock('@/modules/academico/pages/justificaciones-page', () => ({
  JustificacionesPage: () => <p>Bandeja de justificaciones</p>,
}))
vi.mock('@/modules/academico/pages/historial-asistencia-page', () => ({
  HistorialAsistenciaPage: () => <p>Historial integrado</p>,
}))

function RutasAcademico() {
  return useRoutes([...academicoRoutes, { path: '*', element: <p>Inicio</p> }])
}

function renderConPermisos(permisos: string[], ruta = '/academico/justificaciones') {
  const permisosDelRol = permisos.map((codigo, indice) => ({
    id: `p${indice}`,
    codigo,
    modulo: 'Académico',
    accion: codigo.split('.')[1] ?? 'leer',
    tipo_informacion: codigo.split(':')[1] ?? null,
  }))
  const rol = 'direccion'
  useAuthStore.setState({
    usuario: {
      id: 'u1',
      email: 'direccion@esseri.edu.ar',
      auth_provider: 'local',
      estado: 'activo',
      roles: [rol],
      permisos: permisosDelRol,
      perfiles: [
        {
          id: rol,
          codigo: rol,
          nombre: rol,
          descripcion: null,
          permisos: permisosDelRol,
        },
      ],
      rol_activo: rol,
    },
    status: 'authenticated',
    rolActivo: rol,
  })

  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <RutasAcademico />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useAuthStore.setState({ usuario: null, status: 'idle', rolActivo: null })
})

describe('rutas institucionales de justificaciones', () => {
  it('redirects the old export URL to history without removing export authorization', () => {
    renderConPermisos(['academico.leer', 'academico.exportar'], '/academico/exportar-asistencias')
    expect(screen.getByText('Historial integrado')).toBeInTheDocument()
  })
  it('preserves the old export URL permission guard', () => {
    renderConPermisos(['academico.leer'], '/academico/exportar-asistencias')
    expect(screen.getByText('No tenés acceso a esta sección')).toBeInTheDocument()
  })
  it('requiere el permiso específico aunque exista academico.leer', () => {
    renderConPermisos(['academico.leer'])

    expect(screen.getByText('No tenés acceso a esta sección')).toBeInTheDocument()
    expect(screen.queryByText('Bandeja de justificaciones')).not.toBeInTheDocument()
  })

  it('habilita la bandeja con academico.actualizar:justificaciones', () => {
    renderConPermisos(['academico.leer', 'academico.actualizar:justificaciones'])

    expect(screen.getByText('Bandeja de justificaciones')).toBeInTheDocument()
  })
})
