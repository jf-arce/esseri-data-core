import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import type { MateriaCurso } from '@/modules/academico/types'
import { useHorarioFamilia } from '@/modules/academico/hooks/use-horario-familia'
import { useMisAlumnos } from '@/modules/familias-alumnos/hooks/use-mis-alumnos'
import { useEventosFamilia } from '@/modules/comunicaciones/hooks/use-eventos-familia'
import { PortalFamiliaCalendarioPage } from '@/pages/portal-familia-calendario-page'

vi.mock('@/modules/familias-alumnos/hooks/use-mis-alumnos')
vi.mock('@/modules/academico/hooks/use-horario-familia')
vi.mock('@/modules/comunicaciones/hooks/use-eventos-familia')
vi.mock('@/api/client')

const mockedUseMisAlumnos = vi.mocked(useMisAlumnos)
const mockedUseHorarioFamilia = vi.mocked(useHorarioFamilia)
const mockedUseEventosFamilia = vi.mocked(useEventosFamilia)

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
    mockedUseEventosFamilia.mockReturnValue({ eventos: [], cargando: false, error: false })
  })

  afterEach(() => {
    vi.useRealTimers()
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
    mockedUseEventosFamilia.mockReturnValue({
      cargando: false,
      error: false,
      eventos: [
        {
          comunicacion_id: 'c1',
          titulo: 'Encuentro de familias',
          fecha: '2026-12-05',
          hora_inicio: '10:00',
          hora_fin: '11:00',
          lugar: 'Biblioteca',
          descripcion: 'Traer el boletín.',
        },
      ],
    })
    renderizar()
    expect(await screen.findByText('Encuentro de familias')).toBeVisible()
    expect(screen.getByText(/10:00.*11:00.*Biblioteca/)).toBeVisible()
    expect(mockedUseEventosFamilia).toHaveBeenCalledWith(
      'alumno-1',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    )
  })

  it('muestra el horario del alumno a cargo en la grilla semanal', () => {
    renderizar()

    expect(screen.getByText('Calendario')).toBeInTheDocument()
    expect(screen.getByText('4°B · Primario')).toBeInTheDocument()
    const grilla = within(screen.getByTestId('calendario-grilla'))
    expect(grilla.getByText('Matemática')).toBeInTheDocument()
    expect(grilla.getAllByText('08:00 – 09:00').length).toBeGreaterThan(0)
    expect(grilla.queryByText(/Profesor/)).not.toBeInTheDocument()
  })

  it('abre el detalle de la materia en un popover al hacer clic', async () => {
    // La grilla muestra la semana actual: se fija la fecha para que el día no dependa del reloj.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 18, 12))
    mockedUseHorarioFamilia.mockReturnValue({
      materiasCurso: [
        crearMateria(),
        crearMateria({
          id: 'materia-curso-2',
          materia_id: 'materia-2',
          materia_nombre: 'Inglés',
          horarios: [
            { id: 'horario-2', dia_semana: 2, hora_inicio: '09:00:00', hora_fin: '10:00:00' },
          ],
          docentes: ['Laura Díaz'],
        }),
      ],
      cargando: false,
      error: false,
    })
    renderizar()

    const grilla = within(screen.getByTestId('calendario-grilla'))
    const abierto = () =>
      document.querySelector<HTMLElement>('[data-slot="popover-content"][data-state="open"]')
    expect(screen.queryByText('Detalle de clase')).not.toBeInTheDocument()

    fireEvent.click(grilla.getByRole('button', { name: /Matemática: ver detalle/ }))
    await waitFor(() => expect(abierto()).not.toBeNull())
    const detalle = within(abierto()!)
    expect(detalle.getByText('Matemática')).toBeInTheDocument()
    expect(detalle.getByText('María González')).toBeInTheDocument()
    expect(detalle.getByText('08:00 – 09:00')).toBeInTheDocument()
    expect(detalle.getByText(/Lunes 16 de noviembre/i)).toBeInTheDocument()

    fireEvent.click(grilla.getByRole('button', { name: /Inglés: ver detalle/ }))
    await waitFor(() => expect(within(abierto()!).getByText('Laura Díaz')).toBeInTheDocument())
    expect(
      document.querySelectorAll('[data-slot="popover-content"][data-state="open"]'),
    ).toHaveLength(1)

    fireEvent.click(within(abierto()!).getByRole('button', { name: 'Cerrar detalle' }))
    await waitFor(() => expect(abierto()).toBeNull())
  })

  it('abre el detalle de la materia en una hoja inferior en móvil', async () => {
    const usuario = userEvent.setup()
    renderizar()

    const agenda = within(screen.getByTestId('calendario-agenda'))
    await usuario.click(agenda.getByRole('button', { name: /Matemática: ver detalle/ }))
    const detalle = await screen.findByRole('dialog')
    expect(detalle).toHaveTextContent('María González')
    expect(detalle).toHaveTextContent('08:00 – 09:00')
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

  it('muestra el evento en la grilla y abre su detalle desde la grilla y desde la lista', async () => {
    const usuario = userEvent.setup()
    mockedUseHorarioFamilia.mockReturnValue({
      materiasCurso: [
        crearMateria({
          horarios: [
            { id: 'horario-viernes', dia_semana: 5, hora_inicio: '10:20:00', hora_fin: '11:20:00' },
          ],
        }),
      ],
      cargando: false,
      error: false,
    })
    mockedUseEventosFamilia.mockReturnValue({
      cargando: false,
      error: false,
      eventos: [
        {
          comunicacion_id: 'comunicacion-evento',
          titulo: 'Reunión de padres',
          fecha: '2026-11-20',
          hora_inicio: '10:20',
          hora_fin: '11:20',
          lugar: 'Aula de 4.º A',
          descripcion: 'Traer el boletín.',
        },
      ],
    })

    renderizar()

    const grilla = within(screen.getByTestId('calendario-grilla'))
    const enGrilla = grilla.getByRole('button', { name: /Reunión de padres/ })
    expect(enGrilla).toBeInTheDocument()

    const lista = within(screen.getByRole('region', { name: 'Eventos del colegio' }))
    expect(lista.getByText('Se superpone con una clase')).toBeInTheDocument()

    await usuario.click(enGrilla)
    const panel = await screen.findByRole('dialog')
    expect(panel).toHaveTextContent('Evento del colegio')
    expect(panel).toHaveTextContent('Aula de 4.º A')
    expect(panel).toHaveTextContent('Se superpone con otra actividad')
    expect(
      within(panel).getByRole('link', { name: /Ver comunicación relacionada/ }),
    ).toHaveAttribute('href', '/familia/comunicaciones/comunicacion-evento')

    await usuario.click(within(panel).getByRole('button', { name: 'Cerrar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await usuario.click(lista.getByRole('button', { name: /Reunión de padres/ }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('Reunión de padres')
  })

  it('vuelve a pedir los eventos al cambiar de semana y de alumno', async () => {
    const usuario = userEvent.setup()
    mockedUseMisAlumnos.mockReturnValue({
      alumnos: [ALUMNA, { ...ALUMNA, alumno_id: 'alumno-2', nombre: 'Juan', apellido: 'Gómez' }],
      cargando: false,
    })

    renderizar()
    const primeraSemana = mockedUseEventosFamilia.mock.calls.at(-1)?.slice(1)

    await usuario.click(screen.getByRole('button', { name: 'Semana siguiente' }))
    await waitFor(() =>
      expect(mockedUseEventosFamilia.mock.calls.at(-1)?.slice(1)).not.toEqual(primeraSemana),
    )

    await usuario.click(screen.getByRole('combobox', { name: 'Alumno' }))
    await usuario.click(await screen.findByRole('option', { name: 'Juan Gómez' }))
    await waitFor(() =>
      expect(mockedUseEventosFamilia).toHaveBeenLastCalledWith(
        'alumno-2',
        expect.any(String),
        expect.any(String),
      ),
    )
  })
})
