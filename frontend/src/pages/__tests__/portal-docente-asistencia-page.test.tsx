import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PortalDocenteAsistenciaPage } from '@/pages/portal-docente-asistencia-page'
import { PortalDocenteCursoPage } from '@/pages/portal-docente-curso-page'

const mocks = vi.hoisted(() => ({
  useMisDivisiones: vi.fn(),
  useAlumnosDivision: vi.fn(),
  listarAsistencias: vi.fn(),
  obtenerSeguimientoDivisionDocente: vi.fn(),
  useAsistenciaDivision: vi.fn(),
  registrarAsistenciaMasiva: vi.fn(),
}))

vi.mock('@/modules/academico/hooks/use-mis-divisiones', () => ({
  useMisDivisiones: mocks.useMisDivisiones,
}))
vi.mock('@/modules/academico/hooks/use-alumnos-division', () => ({
  useAlumnosDivision: mocks.useAlumnosDivision,
}))
vi.mock('@/modules/academico/hooks/use-asistencia-division', () => ({
  useAsistenciaDivision: mocks.useAsistenciaDivision,
}))
vi.mock('@/modules/academico/services/asistencias', () => ({
  listarAsistencias: mocks.listarAsistencias,
  registrarAsistenciaMasiva: mocks.registrarAsistenciaMasiva,
}))
vi.mock('@/modules/academico/services/docente-academico', () => ({
  obtenerSeguimientoDivisionDocente: mocks.obtenerSeguimientoDivisionDocente,
}))

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
    alumnos: [{ id: 'inscripcion-1', alumno_nombre: 'Valentina', alumno_apellido: 'Acosta' }],
    cargando: false,
    error: null,
    sinPermiso: false,
  })
  mocks.listarAsistencias.mockResolvedValue([])
  mocks.obtenerSeguimientoDivisionDocente.mockResolvedValue([])
  mocks.useAsistenciaDivision.mockReturnValue({
    alumnos: [
      {
        id: 'inscripcion-1',
        alumno_nombre: 'Valentina',
        alumno_apellido: 'Acosta',
        estadoAsistencia: undefined,
      },
    ],
    cargando: false,
    error: null,
    sinPermiso: false,
    recargar: vi.fn(),
  })
  mocks.registrarAsistenciaMasiva.mockResolvedValue(undefined)
})

function renderFlujoPortalDocente() {
  return render(
    <MemoryRouter initialEntries={['/docente/cursos/division-1']}>
      <Routes>
        <Route path="/docente/cursos/:divisionId" element={<PortalDocenteCursoPage />} />
        <Route path="/docente/asistencia/:divisionId" element={<PortalDocenteAsistenciaPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PortalDocenteAsistenciaPage', () => {
  it('returns to the course after a successful attendance save', async () => {
    renderFlujoPortalDocente()

    fireEvent.click(await screen.findByRole('link', { name: /Tomar asistencia/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Presente' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar' }))

    expect(await screen.findByRole('link', { name: /Tomar asistencia/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument()
    expect(mocks.registrarAsistenciaMasiva).toHaveBeenCalledOnce()
  })

  it('stays on attendance when saving fails', async () => {
    mocks.registrarAsistenciaMasiva.mockRejectedValue(new Error('save failed'))
    renderFlujoPortalDocente()

    fireEvent.click(await screen.findByRole('link', { name: /Tomar asistencia/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Presente' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar' }))

    expect(
      await screen.findByRole('heading', { name: /Tomar asistencia · 4°B/ }),
    ).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Guardar' })).toBeInTheDocument()
  })
})
