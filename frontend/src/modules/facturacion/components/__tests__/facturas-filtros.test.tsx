import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FacturasFiltros } from '@/modules/facturacion/components/facturas-filtros'
import { listarConceptosCobro } from '@/modules/facturacion/services/listar-conceptos-cobro'
import { listarAlumnos } from '@/modules/familias-alumnos/services/listar-alumnos'
import type { Alumno } from '@/modules/familias-alumnos/types'

vi.mock('@/modules/familias-alumnos/services/listar-alumnos')
vi.mock('@/modules/facturacion/services/listar-conceptos-cobro')

const ALUMNOS: Alumno[] = [
  {
    id: 'alumno-garcia',
    numero_legajo: 'L-0001',
    estado: 'activo',
    persona_id: 'persona-garcia',
    persona_nombre: 'Ana',
    persona_apellido: 'García',
    persona_dni: '30111222',
    persona_telefono: null,
    persona_sexo: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'alumno-lopez',
    numero_legajo: 'L-0002',
    estado: 'activo',
    persona_id: 'persona-lopez',
    persona_nombre: 'Bea',
    persona_apellido: 'Lopez',
    persona_dni: '40999888',
    persona_telefono: null,
    persona_sexo: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
]

function renderizarFiltros() {
  return render(
    <FacturasFiltros
      estado=""
      alumnoId=""
      conceptoCobroId=""
      onEstadoChange={vi.fn()}
      onAlumnoChange={vi.fn()}
      onConceptoCobroChange={vi.fn()}
    />,
  )
}

describe('FacturasFiltros', () => {
  it('filtra alumnos ignorando tildes y mayúsculas', async () => {
    const user = userEvent.setup()
    vi.mocked(listarAlumnos).mockResolvedValue(ALUMNOS)
    vi.mocked(listarConceptosCobro).mockResolvedValue([])
    renderizarFiltros()

    await user.click(await screen.findByRole('button', { name: 'Alumno' }))
    const buscador = await screen.findByPlaceholderText('Nombre, apellido, DNI o legajo')

    await user.type(buscador, 'garcia')
    await waitFor(() => expect(screen.getByText('García, Ana')).toBeInTheDocument())
    expect(screen.queryByText('Lopez, Bea')).not.toBeInTheDocument()

    await user.clear(buscador)
    await user.type(buscador, 'LÓPEZ')
    await waitFor(() => expect(screen.getByText('Lopez, Bea')).toBeInTheDocument())
    expect(screen.queryByText('García, Ana')).not.toBeInTheDocument()
  })
})
