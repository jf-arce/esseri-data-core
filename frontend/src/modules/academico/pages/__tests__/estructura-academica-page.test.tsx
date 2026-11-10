import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listarAnios } from '@/modules/academico/services/anios'
import { listarAsignaciones } from '@/modules/academico/services/asignaciones-docentes'
import { listarDivisiones } from '@/modules/academico/services/divisiones'
import { listarDocentes } from '@/modules/academico/services/docentes'
import { listarMaterias } from '@/modules/academico/services/materias'
import { listarMateriasCurso } from '@/modules/academico/services/materias-curso'
import { listarNiveles } from '@/modules/academico/services/niveles-educativos'
import { useAuthStore } from '@/store/auth-store'
import { EstructuraAcademicaPage } from '../estructura-academica-page'

vi.mock('@/modules/academico/services/anios')
vi.mock('@/modules/academico/services/asignaciones-docentes')
vi.mock('@/modules/academico/services/divisiones')
vi.mock('@/modules/academico/services/docentes')
vi.mock('@/modules/academico/services/materias')
vi.mock('@/modules/academico/services/materias-curso')
vi.mock('@/modules/academico/services/niveles-educativos')

const marca = { created_at: '', updated_at: '' }

function conPermisos(codigos: string[]) {
  const permisos = codigos.map((codigo, indice) => ({
    id: `p${indice}`,
    codigo,
    modulo: 'Académico',
    accion: codigo.split('.')[1] ?? 'leer',
    tipo_informacion: null,
  }))
  const rol = 'rol'
  useAuthStore.setState({
    usuario: {
      id: 'u1',
      email: 'u@esseri.edu.ar',
      auth_provider: 'local',
      estado: 'activo',
      nombre_google: null,
      avatar_url: null,
      persona_nombre: null,
      persona_apellido: null,
      roles: [rol],
      permisos,
      perfiles: [{ id: rol, codigo: rol, nombre: rol, descripcion: null, permisos }],
      rol_activo: rol,
    },
    status: 'authenticated',
    rolActivo: rol,
  })
}

function montar() {
  return render(
    <MemoryRouter>
      <EstructuraAcademicaPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(listarNiveles).mockResolvedValue([
    { id: 'n1', nombre: 'Primario', cantidad_anios: 1, ...marca },
  ])
  vi.mocked(listarMaterias).mockResolvedValue([])
  vi.mocked(listarDocentes).mockResolvedValue([])
  vi.mocked(listarAsignaciones).mockResolvedValue([])
  vi.mocked(listarMateriasCurso).mockResolvedValue([])
})

describe('EstructuraAcademicaPage', () => {
  it('un nivel sin años ofrece agregar el primero a quien puede editar', async () => {
    conPermisos(['academico.leer', 'academico.actualizar'])
    vi.mocked(listarAnios).mockResolvedValue([])

    montar()

    expect(await screen.findByText('Primario todavía no tiene años.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agregar año' })).toBeInTheDocument()
  })

  it('en solo lectura no hay acciones de edición', async () => {
    conPermisos(['academico.leer'])
    vi.mocked(listarAnios).mockResolvedValue([])

    montar()

    expect(await screen.findByText('Primario todavía no tiene años.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Agregar año' })).not.toBeInTheDocument()
  })

  it('un año sin divisiones sugiere agregar una', async () => {
    conPermisos(['academico.leer', 'academico.actualizar'])
    vi.mocked(listarAnios).mockResolvedValue([
      {
        id: 'a1',
        numero: 1,
        nivel_educativo_id: 'n1',
        cantidad_divisiones: 0,
        cantidad_materias: 0,
        ...marca,
      },
    ])
    vi.mocked(listarDivisiones).mockResolvedValue([])

    montar()

    expect(await screen.findByText('El año 1° todavía no tiene divisiones.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agregar división' })).toBeInTheDocument()
  })

  it('una división sin materias sugiere agregar una; en solo lectura no', async () => {
    conPermisos(['academico.leer'])
    vi.mocked(listarAnios).mockResolvedValue([
      {
        id: 'a1',
        numero: 1,
        nivel_educativo_id: 'n1',
        cantidad_divisiones: 1,
        cantidad_materias: 0,
        ...marca,
      },
    ])
    vi.mocked(listarDivisiones).mockResolvedValue([
      {
        id: 'd1',
        nombre: '1°A',
        anio_id: 'a1',
        cantidad_materias: 0,
        cantidad_inscripciones: 24,
        cantidad_asignaciones: 0,
        ...marca,
      },
    ])

    montar()

    expect(await screen.findByText('1°A todavía no tiene materias.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '1°A' })).toBeInTheDocument()
    expect(screen.getByText('24 alumnos')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Agregar materia' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar división' })).not.toBeInTheDocument()
  })
})
