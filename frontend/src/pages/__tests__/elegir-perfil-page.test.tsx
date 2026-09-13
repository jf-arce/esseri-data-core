import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ElegirPerfilPage } from '@/pages/elegir-perfil-page'
import { getMisDivisiones } from '@/modules/academico/services/get-mis-divisiones'
import { getMisAlumnos } from '@/modules/familias-alumnos/services/get-mis-alumnos'
import { useAuthStore } from '@/store/auth-store'

vi.mock('@/modules/academico/services/get-mis-divisiones')
vi.mock('@/modules/familias-alumnos/services/get-mis-alumnos')

const mockedGetMisDivisiones = vi.mocked(getMisDivisiones)
const mockedGetMisAlumnos = vi.mocked(getMisAlumnos)

// El permiso real de docente (grupo-b.yaml): `actualizar` acotado a asistencia, nunca el
// `actualizar` sin tipo que da acceso a la estructura curricular.
const permisoAcademico = {
  id: 'p1',
  codigo: 'academico.actualizar:asistencia',
  modulo: 'Académico',
  accion: 'actualizar',
  tipo_informacion: 'asistencia',
}
const permisoFacturacion = {
  id: 'p2',
  codigo: 'facturacion.leer',
  modulo: 'Facturación',
  accion: 'leer',
  tipo_informacion: null,
}

function renderPagina() {
  return render(
    <MemoryRouter initialEntries={['/elegir-perfil']}>
      <Routes>
        <Route path="/elegir-perfil" element={<ElegirPerfilPage />} />
        <Route path="/academico/asistencia" element={<p>Tomar asistencia</p>} />
        <Route path="/facturacion" element={<p>Facturas</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedGetMisDivisiones.mockResolvedValue([])
  mockedGetMisAlumnos.mockResolvedValue([])
  useAuthStore.setState({
    usuario: {
      id: 'u1',
      email: 'julieta.amaya@esseri.edu.ar',
      auth_provider: 'local',
      estado: 'activo',
      roles: ['docente', 'familia'],
      permisos: [],
      perfiles: [
        { id: 'docente', nombre: 'docente', descripcion: null, permisos: [permisoAcademico] },
        { id: 'familia', nombre: 'familia', descripcion: null, permisos: [permisoFacturacion] },
      ],
    },
    status: 'authenticated',
    rolActivo: null,
  })
})

describe('ElegirPerfilPage', () => {
  it('muestra una card por cada rol de la cuenta', () => {
    renderPagina()

    expect(screen.getByText('Docente')).toBeInTheDocument()
    expect(screen.getByText('Familia')).toBeInTheDocument()
  })

  it('trae las divisiones del docente para su card', async () => {
    mockedGetMisDivisiones.mockResolvedValue([{ division_id: 'd1', etiqueta: '4°B' }])
    renderPagina()

    expect(await screen.findByText('4°B')).toBeInTheDocument()
  })

  it('no pide alumnos si la cuenta no tiene el rol familia', () => {
    useAuthStore.setState({
      usuario: {
        id: 'u1',
        email: 'julieta.amaya@esseri.edu.ar',
        auth_provider: 'local',
        estado: 'activo',
        roles: ['docente', 'coordinación académica'],
        permisos: [],
        perfiles: [
          { id: 'docente', nombre: 'docente', descripcion: null, permisos: [permisoAcademico] },
          {
            id: 'coordinación académica',
            nombre: 'coordinación académica',
            descripcion: 'Dueña de la estructura curricular',
            permisos: [permisoAcademico],
          },
        ],
      },
      status: 'authenticated',
      rolActivo: null,
    })

    renderPagina()

    expect(mockedGetMisAlumnos).not.toHaveBeenCalled()
  })

  it('elegir un rol y continuar fija el rol activo y navega a su pantalla principal', async () => {
    const user = userEvent.setup()
    renderPagina()

    await user.click(screen.getByText('Docente'))
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(useAuthStore.getState().rolActivo).toBe('docente')
    expect(await screen.findByText('Tomar asistencia')).toBeInTheDocument()
  })

  it('el botón Continuar arranca deshabilitado sin ninguna card elegida', () => {
    renderPagina()

    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
  })
})
