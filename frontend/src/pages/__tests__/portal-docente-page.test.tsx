import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PortalDocentePage } from '@/pages/portal-docente-page'
import { useMisDivisiones } from '@/modules/academico/hooks/use-mis-divisiones'
import {
  listarAlumnosDivisionDocente,
  obtenerPerfilDocenteActual,
} from '@/modules/academico/services/docente-academico'

vi.mock('@/modules/academico/hooks/use-mis-divisiones', () => ({
  useMisDivisiones: vi.fn(),
}))
vi.mock('@/modules/academico/services/docente-academico', () => ({
  listarAlumnosDivisionDocente: vi.fn(),
  obtenerPerfilDocenteActual: vi.fn(),
  obtenerSeguimientoDivisionDocente: vi.fn(),
}))

const mockedUseMisDivisiones = vi.mocked(useMisDivisiones)
const mockedListarAlumnos = vi.mocked(listarAlumnosDivisionDocente)
const mockedObtenerPerfil = vi.mocked(obtenerPerfilDocenteActual)

function RutaActual() {
  const location = useLocation()
  return <p>{location.pathname}</p>
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedObtenerPerfil.mockResolvedValue({ nombre: 'Julieta', apellido: 'Amaya' })
  mockedListarAlumnos.mockResolvedValue({
    items: [],
    total: 24,
    pagina: 1,
    tamanio_pagina: 100,
    total_paginas: 1,
  })
  mockedUseMisDivisiones.mockReturnValue({
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
})

describe('PortalDocentePage', () => {
  it('filtra cursos por el ciclo compartido y abre el detalle del curso', () => {
    render(
      <MemoryRouter initialEntries={['/docente']}>
        <Routes>
          <Route path="/docente" element={<PortalDocentePage />} />
          <Route path="/docente/cursos/:divisionId" element={<RutaActual />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(mockedUseMisDivisiones).toHaveBeenCalledWith(true, '2026')
    fireEvent.click(screen.getByText('4°B'))

    expect(screen.getByText('/docente/cursos/division-1')).toBeInTheDocument()
  })

  it('saluda con el nombre real del docente y muestra alumnos activos a cargo', async () => {
    render(
      <MemoryRouter initialEntries={['/docente']}>
        <Routes>
          <Route path="/docente" element={<PortalDocentePage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Buen día, Julieta' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('24')).toBeInTheDocument())
    expect(screen.getByText('Cursos asignados')).toBeInTheDocument()
    expect(screen.queryByText(/asistencias.*hoy/i)).not.toBeInTheDocument()
  })
})
