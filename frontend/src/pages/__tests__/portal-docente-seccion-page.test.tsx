import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMisDivisiones } from '@/modules/academico/hooks/use-mis-divisiones'
import { PortalDocenteSeccionPage } from '@/pages/portal-docente-seccion-page'

vi.mock('@/modules/academico/hooks/use-mis-divisiones', () => ({
  useMisDivisiones: vi.fn(),
}))

const mockedUseMisDivisiones = vi.mocked(useMisDivisiones)

function RutaActual() {
  const location = useLocation()
  return <p>{location.pathname}</p>
}

beforeEach(() => {
  vi.clearAllMocks()
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

describe('PortalDocenteSeccionPage', () => {
  it('limita la lista al ciclo seleccionado y abre la lista de alumnos de la división', () => {
    render(
      <MemoryRouter initialEntries={['/docente/alumnos']}>
        <Routes>
          <Route path="/docente/alumnos" element={<PortalDocenteSeccionPage seccion="alumnos" />} />
          <Route path="/docente/cursos/:divisionId/alumnos" element={<RutaActual />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(mockedUseMisDivisiones).toHaveBeenCalledWith(true, '2026')
    expect(screen.getByText('4°B')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Ver alumnos'))

    expect(screen.getByText('/docente/cursos/division-1/alumnos')).toBeInTheDocument()
  })

  it('mantiene las divisiones asignadas como acceso al seguimiento del curso', () => {
    render(
      <MemoryRouter initialEntries={['/docente/seguimiento']}>
        <Routes>
          <Route
            path="/docente/seguimiento"
            element={<PortalDocenteSeccionPage seccion="seguimiento" />}
          />
          <Route path="/docente/cursos/:divisionId/seguimiento" element={<RutaActual />} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByText('Ver seguimiento'))

    expect(screen.getByText('/docente/cursos/division-1/seguimiento')).toBeInTheDocument()
  })
})
