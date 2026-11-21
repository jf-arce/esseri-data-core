import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import { FacturasVinculadas } from '@/modules/facturacion/components/facturas-vinculadas'
import { listarFacturas } from '@/modules/facturacion/services/listar-facturas'
import { obtenerFactura } from '@/modules/facturacion/services/obtener-factura'
import type { FacturaDetalle, FacturasListado } from '@/modules/facturacion/types'

vi.mock('@/modules/facturacion/services/listar-facturas')
vi.mock('@/modules/facturacion/services/obtener-factura')

const FACTURA_ID = '11111111-2222-3333-4444-555555555555'

const listado: FacturasListado = {
  items: [
    {
      id: FACTURA_ID,
      fecha_emision: '2027-03-01',
      fecha_vencimiento: '2027-03-10',
      monto_total: '125000.50',
      estado: 'pendiente',
      updated_at: '2027-03-01T00:00:00Z',
      inscripcion_id: 'inscripcion-1',
      responsable_economico_id: 'responsable-1',
      alumno_id: 'alumno-1',
      alumno_nombre: 'Ana',
      alumno_apellido: 'Gómez',
      detalles: [
        {
          id: 'detalle-1',
          descripcion: 'Cuota marzo',
          monto: '125000.50',
          concepto_cobro_id: 'concepto-1',
        },
      ],
    },
  ],
  total: 1,
  pagina: 1,
  tamanio: 5,
}

const detalleFactura: FacturaDetalle = {
  id: FACTURA_ID,
  fecha_emision: '2027-03-01',
  fecha_vencimiento: '2027-03-10',
  monto_total: '125000.50',
  estado: 'pendiente',
  updated_at: '2027-03-01T00:00:00Z',
  inscripcion_id: 'inscripcion-1',
  responsable_economico_id: 'responsable-1',
  alumno_id: 'alumno-1',
  alumno_nombre: 'Ana',
  alumno_apellido: 'Gómez',
  detalles: [
    {
      id: 'detalle-1',
      descripcion: 'Cuota marzo',
      monto: '125000.50',
      concepto_cobro_id: 'concepto-1',
    },
  ],
  alumno_legajo: 'L-1',
  responsable_economico_nombre: 'Gómez, Padre',
  pagos: [],
  recargos: [],
}

function renderizar(props: ComponentProps<typeof FacturasVinculadas>) {
  return render(
    <MemoryRouter>
      <FacturasVinculadas {...props} />
    </MemoryRouter>,
  )
}

describe('FacturasVinculadas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listarFacturas).mockResolvedValue(listado)
    vi.mocked(obtenerFactura).mockResolvedValue(detalleFactura)
  })

  it('lista las facturas de la familia y abre el detalle al elegir una', async () => {
    const user = userEvent.setup()
    renderizar({ familiaResponsableId: 'familia-1' })

    const numero = await screen.findByRole('button', { name: `#${FACTURA_ID.slice(0, 8)}` })
    expect(listarFacturas).toHaveBeenCalledWith(
      expect.objectContaining({ familiaResponsableId: 'familia-1', pagina: 1, tamanio: 5 }),
      expect.any(AbortSignal),
    )
    expect(screen.getByText('Ana Gómez')).toBeInTheDocument()
    expect(screen.getByText(/125\.000,50/)).toBeInTheDocument()

    await user.click(numero)

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(await screen.findByText('Cuota marzo')).toBeInTheDocument()
    await waitFor(() => expect(obtenerFactura).toHaveBeenCalledWith(FACTURA_ID, expect.anything()))
  })

  it('consulta por alumno y no repite la columna de alumno', async () => {
    renderizar({ alumnoId: 'alumno-1' })

    await screen.findByRole('button', { name: `#${FACTURA_ID.slice(0, 8)}` })
    expect(listarFacturas).toHaveBeenCalledWith(
      expect.objectContaining({ alumnoId: 'alumno-1' }),
      expect.any(AbortSignal),
    )
    expect(screen.queryByRole('columnheader', { name: 'Alumno' })).not.toBeInTheDocument()
  })

  it('muestra un aviso cuando no hay facturas', async () => {
    vi.mocked(listarFacturas).mockResolvedValue({ items: [], total: 0, pagina: 1, tamanio: 5 })
    renderizar({ familiaResponsableId: 'familia-1' })

    expect(await screen.findByText('No hay facturas registradas.')).toBeInTheDocument()
  })

  it('avisa cuando la sesión no tiene permiso para ver facturas', async () => {
    vi.mocked(listarFacturas).mockRejectedValue(new ApiError(403, null))
    renderizar({ alumnoId: 'alumno-1' })

    expect(await screen.findByText('No tenés permiso para ver las facturas.')).toBeInTheDocument()
  })

  it('muestra el error de carga y reintenta la consulta', async () => {
    vi.mocked(listarFacturas).mockRejectedValueOnce(new Error('caída')).mockResolvedValue(listado)
    const user = userEvent.setup()
    renderizar({ alumnoId: 'alumno-1' })

    expect(await screen.findByText('No se pudieron cargar las facturas.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(
      await screen.findByRole('button', { name: `#${FACTURA_ID.slice(0, 8)}` }),
    ).toBeInTheDocument()
    expect(listarFacturas).toHaveBeenCalledTimes(2)
  })
})
