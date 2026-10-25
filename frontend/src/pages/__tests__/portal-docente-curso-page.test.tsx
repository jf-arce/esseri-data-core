import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import { PortalDocenteCursoPage } from '@/pages/portal-docente-curso-page'

const mocks = vi.hoisted(() => ({
  useMisDivisiones: vi.fn(),
  useAlumnosDivision: vi.fn(),
  listarAsistencias: vi.fn(),
  obtenerSeguimientoDivisionDocente: vi.fn(),
}))

vi.mock('@/modules/academico/hooks/use-mis-divisiones', () => ({
  useMisDivisiones: mocks.useMisDivisiones,
}))
vi.mock('@/modules/academico/hooks/use-alumnos-division', () => ({
  useAlumnosDivision: mocks.useAlumnosDivision,
}))
vi.mock('@/modules/academico/services/asistencias', () => ({
  listarAsistencias: mocks.listarAsistencias,
}))
vi.mock('@/modules/academico/services/docente-academico', () => ({
  obtenerSeguimientoDivisionDocente: mocks.obtenerSeguimientoDivisionDocente,
}))

function fechaHace(diasAtras: number): string {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() - diasAtras)
  return [
    fecha.getFullYear(),
    String(fecha.getMonth() + 1).padStart(2, '0'),
    String(fecha.getDate()).padStart(2, '0'),
  ].join('-')
}

const asistencias = [
  { id: 'a1', fecha: fechaHace(3), tipo: 'presente', inscripcion_id: 'i1', updated_at: '' },
  { id: 'a2', fecha: fechaHace(2), tipo: 'presente', inscripcion_id: 'i1', updated_at: '' },
  { id: 'a3', fecha: fechaHace(1), tipo: 'tardanza', inscripcion_id: 'i1', updated_at: '' },
  {
    id: 'a4',
    fecha: fechaHace(0),
    tipo: 'ausente_pendiente',
    inscripcion_id: 'i1',
    updated_at: '',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.useMisDivisiones.mockReturnValue({
    divisiones: [
      {
        division_id: 'division-1',
        etiqueta: '4°B',
        anio_numero: 4,
        nivel_educativo_nombre: 'Primario',
      },
    ],
    cargando: false,
  })
  mocks.useAlumnosDivision.mockReturnValue({
    alumnos: [
      { id: 'i1', alumno_nombre: 'Valentina', alumno_apellido: 'Acosta', numero_legajo: 'A-01234' },
    ],
    cargando: false,
    error: null,
    sinPermiso: false,
  })
  mocks.listarAsistencias.mockResolvedValue(asistencias)
  mocks.obtenerSeguimientoDivisionDocente.mockResolvedValue([])
})

describe('PortalDocenteCursoPage', () => {
  it('muestra el porcentaje del ciclo con tardanzas consideradas como asistencia', async () => {
    render(
      <MemoryRouter initialEntries={['/docente/cursos/division-1/alumnos']}>
        <Routes>
          <Route
            path="/docente/cursos/:divisionId/alumnos"
            element={<PortalDocenteCursoPage vista="alumnos" />}
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('cell', { name: '75%' })).toBeInTheDocument()
    expect(mocks.listarAsistencias).toHaveBeenCalledWith({
      division_id: 'division-1',
      ciclo_lectivo: '2026',
    })
  })

  it('no inventa un porcentaje cuando el alumno todavía no tiene asistencias', async () => {
    mocks.listarAsistencias.mockResolvedValue([])
    render(
      <MemoryRouter initialEntries={['/docente/cursos/division-1/alumnos']}>
        <Routes>
          <Route
            path="/docente/cursos/:divisionId/alumnos"
            element={<PortalDocenteCursoPage vista="alumnos" />}
          />
        </Routes>
      </MemoryRouter>,
    )

    const fila = await screen.findByRole('row', { name: /Acosta, Valentina/ })
    expect(within(fila).getAllByRole('cell')[3]).toHaveTextContent('Sin registros')
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
  })

  it('agrupa presentes, tardanzas y ausencias reales en el gráfico del curso', async () => {
    render(
      <MemoryRouter initialEntries={['/docente/cursos/division-1']}>
        <Routes>
          <Route path="/docente/cursos/:divisionId" element={<PortalDocenteCursoPage />} />
        </Routes>
      </MemoryRouter>,
    )

    const grafico = await screen.findByRole('img', { name: /asistencia de los últimos 30 días/i })
    expect(grafico.getAttribute('aria-label')).toContain('ausencias')
    expect(screen.getByText('Presentes')).toBeInTheDocument()
    expect(screen.getByText('Ausencias')).toBeInTheDocument()
    expect(screen.getByText('Tardanzas')).toBeInTheDocument()
  })

  it('shows fallback messages when an API error has no detail', async () => {
    mocks.listarAsistencias.mockRejectedValue(new ApiError(500, null))
    mocks.obtenerSeguimientoDivisionDocente.mockRejectedValue(new ApiError(500, null))
    render(
      <MemoryRouter initialEntries={['/docente/cursos/division-1']}>
        <Routes>
          <Route path="/docente/cursos/:divisionId" element={<PortalDocenteCursoPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(
      await screen.findByText('No se pudo cargar el seguimiento académico.'),
    ).toBeInTheDocument()
    expect(
      await screen.findByText('No se pudieron cargar las asistencias del curso.'),
    ).toBeInTheDocument()
  })
})
