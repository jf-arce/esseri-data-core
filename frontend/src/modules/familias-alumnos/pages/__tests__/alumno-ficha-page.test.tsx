import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listarFacturas } from '@/modules/facturacion/services/listar-facturas'
import { listarCiclosFacturas } from '@/modules/facturacion/services/listar-ciclos-facturas'
import { obtenerCuentaCorriente } from '@/modules/facturacion/services/obtener-cuenta-corriente'
import { AlumnoFichaPage } from '@/modules/familias-alumnos/pages/alumno-ficha-page'
import { listarVinculosAlumno } from '@/modules/familias-alumnos/services/listar-vinculos-alumno'
import { obtenerAlumno } from '@/modules/familias-alumnos/services/obtener-alumno'
import type { Alumno } from '@/modules/familias-alumnos/types'

vi.mock('@/modules/familias-alumnos/services/obtener-alumno')
vi.mock('@/modules/familias-alumnos/services/listar-vinculos-alumno')
vi.mock('@/modules/facturacion/services/obtener-cuenta-corriente')
vi.mock('@/modules/facturacion/services/listar-facturas')
vi.mock('@/modules/facturacion/services/listar-ciclos-facturas')
vi.mock('@/modules/auditoria/components/historial-cambios', () => ({
  HistorialCambios: () => null,
}))

const alumno: Alumno = {
  id: 'alumno-1',
  numero_legajo: 'L-1',
  estado: 'activo',
  persona_id: 'persona-1',
  persona_nombre: 'Ana',
  persona_apellido: 'Gómez',
  persona_dni: '30111222',
  persona_telefono: null,
  persona_sexo: null,
  created_at: '2027-01-01T00:00:00Z',
  updated_at: '2027-01-01T00:00:00Z',
}

function renderizarPagina() {
  return render(
    <MemoryRouter initialEntries={['/familias-alumnos/alumnos/alumno-1']}>
      <Routes>
        <Route path="/familias-alumnos/alumnos/:alumnoId" element={<AlumnoFichaPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AlumnoFichaPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(obtenerAlumno).mockResolvedValue(alumno)
    vi.mocked(listarVinculosAlumno).mockResolvedValue([])
    vi.mocked(obtenerCuentaCorriente).mockResolvedValue({
      cuenta_corriente_id: 'cuenta-1',
      alumno_id: 'alumno-1',
      total_debe: '0.00',
      total_haber: '0.00',
      saldo: '0.00',
      movimientos: [],
      total_movimientos: 0,
      pagina: 1,
      tamanio: 10,
    })
    vi.mocked(listarFacturas).mockResolvedValue({ items: [], total: 0, pagina: 1, tamanio: 5 })
    vi.mocked(listarCiclosFacturas).mockResolvedValue(['2027'])
  })

  it('muestra las facturas del alumno en su pestaña de facturación', async () => {
    const user = userEvent.setup()
    renderizarPagina()

    await user.click(await screen.findByRole('tab', { name: 'Facturación' }))

    await waitFor(() =>
      expect(listarFacturas).toHaveBeenCalledWith(
        expect.objectContaining({ alumnoId: 'alumno-1', pagina: 1, tamanio: 5 }),
        expect.any(AbortSignal),
      ),
    )
    expect(await screen.findByText('No hay facturas registradas.')).toBeInTheDocument()
  })
})
