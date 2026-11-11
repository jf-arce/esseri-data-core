import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/store/auth-store'
import type { Materia } from '../../types'
import { CatalogoMateriasPage } from '../catalogo-materias-page'
import { listarMaterias } from '../../services/materias'

vi.mock('../../services/materias', () => ({
  listarMaterias: vi.fn(),
}))

const materia: Materia = {
  id: 'm1',
  nombre: 'Matemática',
  tipo: 'materia',
  color: '#2563eb',
  cantidad_cursos: 2,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function conPermisos(codigos: string[]) {
  const permisos = codigos.map((codigo, indice) => ({
    id: `p${indice}`,
    codigo,
    modulo: 'Académico',
    accion: codigo.split('.')[1] ?? 'leer',
    tipo_informacion: null,
  }))
  const rol = 'direccion'
  useAuthStore.setState({
    usuario: {
      id: 'u1',
      email: 'direccion@esseri.edu.ar',
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

describe('CatalogoMateriasPage', () => {
  beforeEach(() => {
    vi.mocked(listarMaterias).mockReset()
  })

  it('muestra las acciones de edición con el permiso de escritura', async () => {
    conPermisos(['academico.leer', 'academico.actualizar'])
    vi.mocked(listarMaterias).mockResolvedValue([materia])

    render(<CatalogoMateriasPage />)

    expect(await screen.findByText('Matemática')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agregar materia' })).toBeInTheDocument()
  })

  it('oculta las acciones de edición solo con lectura', async () => {
    conPermisos(['academico.leer'])
    vi.mocked(listarMaterias).mockResolvedValue([materia])

    render(<CatalogoMateriasPage />)

    expect(await screen.findByText('Matemática')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Agregar materia' })).not.toBeInTheDocument()
  })

  it('sugiere crear la primera materia cuando el catálogo está vacío y puede editar', async () => {
    conPermisos(['academico.leer', 'academico.actualizar'])
    vi.mocked(listarMaterias).mockResolvedValue([])

    render(<CatalogoMateriasPage />)

    expect(await screen.findByText(/Acción sugerida/)).toBeInTheDocument()
  })
})
