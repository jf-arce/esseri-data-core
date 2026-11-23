import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listarAnios } from '@/modules/academico/services/anios'
import { listarDivisiones } from '@/modules/academico/services/divisiones'
import { getMisDivisiones } from '@/modules/academico/services/get-mis-divisiones'
import { listarNiveles } from '@/modules/academico/services/niveles-educativos'
import { useAuthStore } from '@/store/auth-store'
import { DivisionSelectorCards } from '../division-selector-cards'

vi.mock('@/modules/academico/services/anios')
vi.mock('@/modules/academico/services/divisiones')
vi.mock('@/modules/academico/services/get-mis-divisiones')
vi.mock('@/modules/academico/services/niveles-educativos')

const marca = { created_at: '', updated_at: '' }

function autenticar(permisos: string[]) {
  const lista = permisos.map((codigo, i) => ({
    id: `p${i}`,
    codigo,
    modulo: 'Académico',
    accion: codigo.split('.')[1],
    tipo_informacion: null,
  }))
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
      permisos: lista,
      perfiles: [{ id: 'rol', codigo: 'rol', nombre: 'rol', descripcion: null, permisos: lista }],
      rol_activo: 'rol',
    },
    status: 'authenticated',
    rolActivo: 'rol',
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(listarNiveles).mockResolvedValue([
    { id: 'n1', nombre: 'Primario', cantidad_anios: 2, ...marca },
    { id: 'n2', nombre: 'Secundario', cantidad_anios: 1, ...marca },
  ])
  vi.mocked(listarAnios).mockResolvedValue([
    {
      id: 'a1',
      numero: 1,
      nivel_educativo_id: 'n1',
      cantidad_divisiones: 1,
      cantidad_materias: 0,
      ...marca,
    },
    {
      id: 'a2',
      numero: 2,
      nivel_educativo_id: 'n1',
      cantidad_divisiones: 0,
      cantidad_materias: 0,
      ...marca,
    },
    {
      id: 'a6',
      numero: 6,
      nivel_educativo_id: 'n2',
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
      cantidad_inscripciones: 0,
      cantidad_asignaciones: 0,
      ...marca,
    },
    {
      id: 'd2',
      nombre: '1°B',
      anio_id: 'a1',
      cantidad_materias: 0,
      cantidad_inscripciones: 0,
      cantidad_asignaciones: 0,
      ...marca,
    },
    {
      id: 'd6',
      nombre: '6°A',
      anio_id: 'a6',
      cantidad_materias: 0,
      cantidad_inscripciones: 0,
      cantidad_asignaciones: 0,
      ...marca,
    },
  ])
})

describe('DivisionSelectorCards', () => {
  it('desbloquea año y división a medida que se elige', async () => {
    autenticar(['academico.leer', 'academico.actualizar'])
    const onChange = vi.fn()
    render(<DivisionSelectorCards value={null} onChange={onChange} />)

    expect(await screen.findByRole('button', { name: 'Primario' })).toBeInTheDocument()
    expect(screen.getByText('Elegí un nivel para ver sus años.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Primario' }))
    expect(onChange).toHaveBeenLastCalledWith(null)
    expect(await screen.findByRole('button', { name: '1° año' })).toBeInTheDocument()
    expect(screen.getByText('Elegí un año para ver sus divisiones.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '1° año' }))
    await userEvent.click(await screen.findByRole('button', { name: '1°B' }))

    expect(onChange).toHaveBeenLastCalledWith('d2')
  })

  it('solo muestra los años del nivel elegido', async () => {
    autenticar(['academico.leer', 'academico.actualizar'])
    render(<DivisionSelectorCards value={null} onChange={vi.fn()} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Secundario' }))

    expect(await screen.findByRole('button', { name: '6° año' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '1° año' })).not.toBeInTheDocument()
  })

  it('para docentes arma la jerarquía con sus divisiones asignadas', async () => {
    autenticar(['academico.actualizar:asistencia'])
    vi.mocked(getMisDivisiones).mockResolvedValue([
      {
        division_id: 'd9',
        etiqueta: '4°B',
        anio_numero: 4,
        nivel_educativo_nombre: 'Primario',
        cantidad_materias: 1,
      },
    ])
    const onChange = vi.fn()
    render(<DivisionSelectorCards value={null} onChange={onChange} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Primario' }))
    await userEvent.click(await screen.findByRole('button', { name: '4° año' }))
    await userEvent.click(await screen.findByRole('button', { name: '4°B' }))

    expect(onChange).toHaveBeenLastCalledWith('d9')
    expect(listarNiveles).not.toHaveBeenCalled()
    expect(listarDivisiones).not.toHaveBeenCalled()
  })

  it('reconstruye nivel y año cuando llega con una división elegida', async () => {
    autenticar(['academico.leer', 'academico.actualizar'])
    render(<DivisionSelectorCards value="d6" onChange={vi.fn()} />)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Secundario' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    )
    expect(screen.getByRole('button', { name: '6° año' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '6°A' })).toHaveAttribute('aria-pressed', 'true')
  })
})
