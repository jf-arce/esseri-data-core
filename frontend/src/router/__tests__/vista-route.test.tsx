import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { VistaRoute } from '@/router/vista-route'
import { useAuthStore } from '@/store/auth-store'

const permisoAsistencia = {
  id: 'p1',
  codigo: 'academico.actualizar:asistencia',
  modulo: 'Académico',
  accion: 'actualizar',
  tipo_informacion: 'asistencia',
}
const permisoFamilias = {
  id: 'p2',
  codigo: 'familias_alumnos.leer',
  modulo: 'Familias y Alumnos',
  accion: 'leer',
  tipo_informacion: null,
}

function renderConRolActivo(rolActivo: string | null, initialEntry: string) {
  useAuthStore.setState({
    usuario: {
      id: 'u1',
      email: 'a@esseri.edu.ar',
      auth_provider: 'local',
      estado: 'activo',
      roles: ['docente', 'secretaría'],
      permisos: [],
      perfiles: [
        {
          id: 'docente',
          codigo: 'docente',
          nombre: 'docente',
          descripcion: null,
          permisos: [permisoAsistencia],
        },
        {
          id: 'secretaria',
          codigo: 'secretaria',
          nombre: 'secretaría',
          descripcion: null,
          permisos: [permisoFamilias],
        },
      ],
      rol_activo: rolActivo,
    },
    status: 'authenticated',
    rolActivo,
  })

  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<VistaRoute vista="consola" />}>
          <Route path="/familias-alumnos" element={<p>Consola</p>} />
        </Route>
        <Route element={<VistaRoute vista="docente" />}>
          <Route path="/docente" element={<p>Portal docente</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useAuthStore.setState({ usuario: null, status: 'idle', rolActivo: null })
})

describe('VistaRoute', () => {
  it('un rol de Portal (docente) no entra a una ruta de Consola: lo redirige a su propio inicio', () => {
    renderConRolActivo('docente', '/familias-alumnos')

    expect(screen.getByText('Portal docente')).toBeInTheDocument()
  })

  it('un rol de Consola no entra al Portal Docente: lo redirige a su propio inicio', () => {
    renderConRolActivo('secretaria', '/docente')

    expect(screen.getByText('Consola')).toBeInTheDocument()
  })

  it('un rol renderiza su propia vista sin redirigir', () => {
    renderConRolActivo('docente', '/docente')

    expect(screen.getByText('Portal docente')).toBeInTheDocument()
  })
})
