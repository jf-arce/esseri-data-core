import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GlobalSearchDialog } from '@/layout/global-search-dialog'
import { listarFacturas } from '@/modules/facturacion/services/listar-facturas'
import { listarInscripciones } from '@/modules/inscripciones/services/listar-inscripciones'
import { listarSolicitudesAdmision } from '@/modules/inscripciones/services/solicitudes-admision'

vi.mock('@/modules/facturacion/services/listar-facturas')
vi.mock('@/modules/inscripciones/services/listar-inscripciones')
vi.mock('@/modules/inscripciones/services/solicitudes-admision')

const mockedListarFacturas = vi.mocked(listarFacturas)
const mockedListarInscripciones = vi.mocked(listarInscripciones)
const mockedListarSolicitudesAdmision = vi.mocked(listarSolicitudesAdmision)

function renderDialogo() {
  return render(
    <MemoryRouter>
      <GlobalSearchDialog open onOpenChange={() => {}} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedListarInscripciones.mockResolvedValue({
    items: [
      {
        id: 'inscripcion-1',
        alumno_nombre: 'Sofía',
        alumno_apellido: 'Demo',
        numero_legajo: 'DEMO-001',
        division_nombre: '1° A',
      },
    ],
  } as never)
  mockedListarSolicitudesAdmision.mockResolvedValue({
    items: [
      {
        id: 'solicitud-1',
        aspirante_nombre: 'Martina',
        aspirante_apellido: 'Ibáñez',
        etapa: 'entrevista',
        ciclo_lectivo: '2027',
      },
    ],
  } as never)
  mockedListarFacturas.mockResolvedValue({
    items: [
      {
        id: 'abc12345-0000-0000-0000-000000000000',
        estado: 'pendiente',
        monto_total: '20000.00',
      },
    ],
  } as never)
})

describe('GlobalSearchDialog', () => {
  it('ofrece accesos a los submódulos clave', () => {
    renderDialogo()

    expect(screen.getByText('Nueva inscripción')).toBeInTheDocument()
    expect(screen.getByText('Admisiones')).toBeInTheDocument()
    expect(screen.getByText('Reglas de facturación')).toBeInTheDocument()
  })

  it('busca inscripciones, admisiones y facturas desde la misma paleta', async () => {
    const user = userEvent.setup()
    renderDialogo()

    await user.type(
      screen.getByPlaceholderText('Buscar alumno, aspirante, legajo, DNI o factura…'),
      'Sofía',
    )

    await waitFor(() => expect(screen.getByText('Demo, Sofía')).toBeInTheDocument())
    expect(mockedListarSolicitudesAdmision).toHaveBeenCalled()
    expect(mockedListarFacturas).toHaveBeenCalled()
  })

  it('conserva los resultados autorizados si un módulo no puede consultarse', async () => {
    const user = userEvent.setup()
    mockedListarFacturas.mockRejectedValue(new Error('Sin permiso'))
    renderDialogo()

    await user.type(
      screen.getByPlaceholderText('Buscar alumno, aspirante, legajo, DNI o factura…'),
      'Sofía',
    )

    await waitFor(() => expect(screen.getByText('Demo, Sofía')).toBeInTheDocument())
  })
})
