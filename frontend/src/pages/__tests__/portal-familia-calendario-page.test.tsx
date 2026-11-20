import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import type { MateriaCurso } from '@/modules/academico/types'
import { useHorarioFamilia } from '@/modules/academico/hooks/use-horario-familia'
import { useMisAlumnos } from '@/modules/familias-alumnos/hooks/use-mis-alumnos'
import { PortalFamiliaCalendarioPage } from '@/pages/portal-familia-calendario-page'

vi.mock('@/modules/familias-alumnos/hooks/use-mis-alumnos')
vi.mock('@/modules/academico/hooks/use-horario-familia')
vi.mock('@/api/client')

const mockedUseMisAlumnos = vi.mocked(useMisAlumnos)
const mockedUseHorarioFamilia = vi.mocked(useHorarioFamilia)

function crearMateria(overrides: Partial<MateriaCurso> = {}): MateriaCurso {
  return {
    id: 'materia-curso-1',
    materia_id: 'materia-1',
    materia_nombre: 'Matemática',
    materia_tipo: 'materia',
    materia_color: '#2563eb',
    division_id: 'division-1',
    division_nombre: '4°B',
    anio_id: 'anio-1',
    anio_numero: 4,
    nivel_educativo_id: 'nivel-1',
    nivel_educativo_nombre: 'Primario',
    horarios: [{ id: 'horario-1', dia_semana: 1, hora_inicio: '08:00:00', hora_fin: '09:00:00' }],
    docentes: ['María González'],
    cantidad_asignaciones: 1,
    created_at: '2027-01-01T00:00:00',
    updated_at: '2027-01-01T00:00:00',
    ...overrides,
  }
}

const ALUMNA = {
  alumno_id: 'alumno-1',
  nombre: 'Martina',
  apellido: 'Ibáñez',
  division_etiqueta: '4°B · Primario',
}

describe('PortalFamiliaCalendarioPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(apiClient).mockResolvedValue([])
    mockedUseMisAlumnos.mockReturnValue({ alumnos: [ALUMNA], cargando: false })
    mockedUseHorarioFamilia.mockReturnValue({
      materiasCurso: [crearMateria()],
      cargando: false,
      error: false,
    })
  })

  function renderizar() {
    return render(
      <MemoryRouter>
        <PortalFamiliaCalendarioPage />
      </MemoryRouter>,
    )
  }

  it('preselecciona el alumno indicado en la URL', () => {
    mockedUseMisAlumnos.mockReturnValue({
      alumnos: [ALUMNA, { ...ALUMNA, alumno_id: 'alumno-2', nombre: 'Juan', apellido: 'Gómez' }],
      cargando: false,
    })

    render(
      <MemoryRouter initialEntries={['/familia/calendario?alumno=alumno-2']}>
        <PortalFamiliaCalendarioPage />
      </MemoryRouter>,
    )

    expect(mockedUseHorarioFamilia).toHaveBeenCalledWith('alumno-2')
  })

  it('muestra eventos del alumno aunque el curso todavía no tenga horario', async () => {
    mockedUseHorarioFamilia.mockReturnValue({ materiasCurso: [], cargando: false, error: false })
    vi.mocked(apiClient).mockResolvedValue([
      {
        comunicacion_id: 'c1',
        titulo: 'Encuentro de familias',
        fecha: '2026-12-05',
        hora_inicio: '10:00',
        hora_fin: '11:00',
        lugar: 'Biblioteca',
        descripcion: 'Traer el boletín.',
      },
    ])
    renderizar()
    expect(await screen.findByText('Encuentro de familias')).toBeVisible()
    expect(screen.getByText(/10:00.*11:00.*Biblioteca/)).toBeVisible()
    expect(vi.mocked(apiClient)).toHaveBeenCalledWith(
      expect.stringMatching(/^\/comunicaciones\/familia\/eventos\?alumno_id=alumno-1&desde=/),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('muestra el horario del alumno a cargo en la grilla semanal', () => {
    renderizar()

    expect(screen.getByText('Horario semanal')).toBeInTheDocument()
    expect(screen.getByText('4°B · Primario')).toBeInTheDocument()
    const grilla = within(screen.getByTestId('calendario-grilla'))
    expect(grilla.getByText('Matemática')).toBeInTheDocument()
    expect(grilla.getAllByText('08:00 – 09:00').length).toBeGreaterThan(0)
    expect(grilla.queryByText(/Profesor/)).not.toBeInTheDocument()
  })

  it('muestra el docente solo en el detalle de clase', () => {
    mockedUseHorarioFamilia.mockReturnValue({
      materiasCurso: [
        crearMateria(),
        crearMateria({
          id: 'materia-curso-2',
          materia_id: 'materia-2',
          materia_nombre: 'Inglés',
          horarios: [
            { id: 'horario-2', dia_semana: 3, hora_inicio: '09:00:00', hora_fin: '10:00:00' },
          ],
          docentes: ['Laura Díaz'],
        }),
      ],
      cargando: false,
      error: false,
    })
    renderizar()

    const grilla = within(screen.getByTestId('calendario-grilla'))
    expect(grilla.queryByText(/Profesor/)).not.toBeInTheDocument()
    expect(grilla.getAllByText('09:00 – 10:00').length).toBeGreaterThan(0)
    expect(screen.getByText('Detalle de clase')).toBeInTheDocument()
    expect(screen.getByText('Día')).toBeInTheDocument()
    expect(screen.getByText('Docente')).toBeInTheDocument()
    expect(screen.getAllByText('María González').length).toBeGreaterThan(0)
  })

  it('permite recorrer los días en la agenda compacta', async () => {
    const usuario = userEvent.setup()
    renderizar()

    const agenda = within(screen.getByTestId('calendario-agenda'))
    expect(agenda.getByText('Matemática')).toBeInTheDocument()
    expect(agenda.getByText('Profesor: María González')).toBeInTheDocument()

    await usuario.click(agenda.getByRole('tab', { name: 'Miércoles' }))
    expect(agenda.getByText('No hay clases este día.')).toBeInTheDocument()

    await usuario.click(agenda.getByRole('tab', { name: 'Lunes' }))
    expect(agenda.getByText('Matemática')).toBeInTheDocument()
    expect(agenda.getByText('Profesor: María González')).toBeInTheDocument()
  })

  it('cambia de alumno y vuelve a pedir el horario del seleccionado', async () => {
    const usuario = userEvent.setup()
    mockedUseMisAlumnos.mockReturnValue({
      alumnos: [
        ALUMNA,
        {
          alumno_id: 'alumno-2',
          nombre: 'Julián',
          apellido: 'Díaz',
          division_etiqueta: '2°A · Primario',
        },
      ],
      cargando: false,
    })
    renderizar()

    expect(mockedUseHorarioFamilia).toHaveBeenCalledWith('alumno-1')

    await usuario.click(screen.getByRole('combobox', { name: 'Alumno' }))
    await usuario.click(screen.getByRole('option', { name: 'Julián Díaz' }))

    await waitFor(() => expect(mockedUseHorarioFamilia).toHaveBeenCalledWith('alumno-2'))
  })

  it('avisa cuando la familia no tiene alumnos vinculados', () => {
    mockedUseMisAlumnos.mockReturnValue({ alumnos: [], cargando: false })

    renderizar()

    expect(screen.getByText('No encontramos alumnos vinculados')).toBeInTheDocument()
  })

  it('muestra un estado vacío si el curso todavía no tiene materias', () => {
    mockedUseHorarioFamilia.mockReturnValue({ materiasCurso: [], cargando: false, error: false })

    renderizar()

    expect(screen.getByText('Todavía no hay materias cargadas')).toBeInTheDocument()
  })
})
