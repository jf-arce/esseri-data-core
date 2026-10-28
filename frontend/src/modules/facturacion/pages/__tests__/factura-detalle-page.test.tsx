import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FacturaDetallePage } from '@/modules/facturacion/pages/factura-detalle-page'
import { obtenerFactura } from '@/modules/facturacion/services/obtener-factura'
import type { FacturaDetalle } from '@/modules/facturacion/types'

vi.mock('@/modules/facturacion/services/obtener-factura')

const factura: FacturaDetalle = {
  id: 'f-1234567890',
  fecha_emision: '2026-08-01',
  fecha_vencimiento: '2026-08-10',
  monto_total: '120000.00',
  estado: 'vencida',
  updated_at: '2026-10-27T10:00:00Z',
  inscripcion_id: 'i-1',
  responsable_economico_id: 'r-1',
  alumno_id: 'a-1',
  alumno_nombre: 'Ana',
  alumno_apellido: 'Castro',
  detalles: [
    { id: 'd-1', descripcion: 'Cuota agosto', monto: '120000.00', concepto_cobro_id: 'c-1' },
  ],
  alumno_legajo: 'L-1',
  responsable_economico_nombre: 'Castro, Santiago',
  pagos: [],
  recargos: [],
}

function renderPagina() {
  return render(
    <MemoryRouter initialEntries={['/facturacion/facturas/f-1234567890']}>
      <Routes>
        <Route path="/facturacion/facturas/:facturaId" element={<FacturaDetallePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.mocked(obtenerFactura).mockReset()
})

describe('FacturaDetallePage: recargos por mora', () => {
  it('no muestra el bloque si la factura no tiene recargos', async () => {
    vi.mocked(obtenerFactura).mockResolvedValue(factura)
    renderPagina()

    await screen.findByText('Cuota agosto')
    expect(screen.queryByText('Recargos por mora')).not.toBeInTheDocument()
  })

  it('lista los recargos y aclara que no cambian el saldo de la factura', async () => {
    vi.mocked(obtenerFactura).mockResolvedValue({
      ...factura,
      recargos: [
        {
          id: 'm-1',
          fecha: '2026-10-27T18:40:00Z',
          monto: '36000.00',
          observacion: 'Penalidad por mora: tramo 16–30 días (30 %)',
        },
      ],
    })
    renderPagina()

    expect(await screen.findByText('Recargos por mora')).toBeInTheDocument()
    expect(screen.getByText('Penalidad por mora: tramo 16–30 días (30 %)')).toBeInTheDocument()
    expect(screen.getByText(/36\.000,00/)).toBeInTheDocument()
    expect(screen.getByText(/no modifican el total ni el saldo/)).toBeInTheDocument()
  })
})
