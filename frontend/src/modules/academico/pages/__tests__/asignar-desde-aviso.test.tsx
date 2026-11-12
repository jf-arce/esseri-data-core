import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listarAnios } from '@/modules/academico/services/anios'
import {
  crearAsignacionesBulk,
  listarAsignaciones,
} from '@/modules/academico/services/asignaciones-docentes'
import { listarDivisiones } from '@/modules/academico/services/divisiones'
import { listarDocentes } from '@/modules/academico/services/docentes'
import { listarMaterias } from '@/modules/academico/services/materias'
import {
  listarMateriasCurso,
  listarMateriasSinDocente,
} from '@/modules/academico/services/materias-curso'
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

beforeEach(() => {
  vi.resetAllMocks()
  const permisos = ['academico.leer', 'academico.actualizar', 'academico.crear'].map(
    (codigo, i) => ({
      id: `p${i}`,
      codigo,
      modulo: 'Académico',
      accion: codigo.split('.')[1],
      tipo_informacion: null,
    }),
  )
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
      roles: ['rol'],
      permisos,
      perfiles: [{ id: 'rol', codigo: 'rol', nombre: 'rol', descripcion: null, permisos }],
      rol_activo: 'rol',
    },
    status: 'authenticated',
    rolActivo: 'rol',
  })
  vi.mocked(listarNiveles).mockResolvedValue([
    { id: 'n1', nombre: 'Primario', cantidad_anios: 1, ...marca },
  ])
  vi.mocked(listarAnios).mockResolvedValue([])
  vi.mocked(listarMaterias).mockResolvedValue([])
  vi.mocked(listarDocentes).mockResolvedValue([
    { id: 'dc1', legajo: 'D-1', persona_id: 'p1', nombre: 'Ana', apellido: 'Pérez', ...marca },
  ])
  vi.mocked(listarAsignaciones).mockResolvedValue([])
  vi.mocked(listarMateriasCurso).mockResolvedValue([
    {
      id: 'mc1',
      materia_id: 'm1',
      materia_nombre: 'Lengua',
      materia_tipo: 'materia',
      materia_color: '#2563eb',
      division_id: 'd1',
      division_nombre: '4°B',
      anio_id: 'a1',
      anio_numero: 4,
      nivel_educativo_id: 'n1',
      nivel_educativo_nombre: 'Primario',
      horarios: [],
      cantidad_asignaciones: 0,
      ...marca,
    },
  ])
  vi.mocked(listarDivisiones).mockResolvedValue([
    {
      id: 'd1',
      nombre: '4°B',
      anio_id: 'a1',
      cantidad_materias: 1,
      cantidad_inscripciones: 0,
      cantidad_asignaciones: 0,
      ...marca,
    },
  ])
  vi.mocked(listarMateriasSinDocente).mockResolvedValue([
    {
      materia_curso_id: 'mc1',
      materia_id: 'm1',
      materia_nombre: 'Lengua',
      materia_color: '#2563eb',
      division_id: 'd1',
      division_nombre: '4°B',
      anio_id: 'a1',
      anio_numero: 4,
      nivel_educativo_id: 'n1',
      nivel_educativo_nombre: 'Primario',
    },
  ])
  vi.mocked(crearAsignacionesBulk).mockResolvedValue({ creadas: [], omitidas: [] })
})

describe('asignar desde el aviso', () => {
  it('asigna el docente sin error', async () => {
    render(
      <MemoryRouter>
        <EstructuraAcademicaPage />
      </MemoryRouter>,
    )
    await userEvent.click(await screen.findByRole('button', { name: '1 materia sin docente' }))
    await userEvent.click(screen.getByRole('button', { name: /Asignar docente a Lengua/ }))
    await userEvent.click(await screen.findByRole('combobox', { name: 'Docente' }))
    await userEvent.click(await screen.findByText('D-1 - Ana Pérez'))
    await userEvent.click(screen.getByRole('button', { name: 'Asignar materias' }))

    expect(crearAsignacionesBulk).toHaveBeenCalled()
    expect(screen.queryByText('Ocurrió un error inesperado.')).not.toBeInTheDocument()
  })
})
