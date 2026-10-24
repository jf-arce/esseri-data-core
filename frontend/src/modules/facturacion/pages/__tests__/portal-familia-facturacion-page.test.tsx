import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PortalFamiliaFacturacionPage } from '@/modules/facturacion/pages/portal-familia-facturacion-page'
import { descargarComprobantePagoFamilia } from '@/modules/facturacion/services/descargar-comprobante-pago-familia'
import { listarFacturacionFamilia } from '@/modules/facturacion/services/listar-facturacion-familia'
import type { FacturacionFamilia } from '@/modules/facturacion/types'

vi.mock('@/modules/facturacion/services/descargar-comprobante-pago-familia')
vi.mock('@/modules/facturacion/services/listar-facturacion-familia')

const mockedDescargarComprobante = vi.mocked(descargarComprobantePagoFamilia)
const mockedListarFacturacion = vi.mocked(listarFacturacionFamilia)

const facturacion: FacturacionFamilia = {
  total_debe: '125.00',
  total_haber: '25.00',
  saldo: '100.00',
  facturas: [
    {
      id: 'factura-1',
      fecha_emision: '2026-03-01',
      fecha_vencimiento: '2026-03-10',
      monto_total: '125.00',
      estado: 'pendiente',
      alumno_nombre: 'Tiziano Cabral',
      detalles: [{ descripcion: 'Cuota de marzo', monto: '125.00' }],
      pagos: [
        {
          id: 'pago-1',
          fecha: '2026-03-05',
          monto: '25.00',
          estado: 'aprobado',
          metodo_pago: 'Transferencia',
          comprobante_disponible: true,
        },
      ],
    },
  ],
  movimientos: [
    {
      fecha: '2026-03-01T03:00:00Z',
      tipo: 'debe',
      monto: '125.00',
      observacion: 'Cuota de marzo',
      factura_id: 'factura-1',
    },
    {
      fecha: '2026-03-05T00:00:00Z',
      tipo: 'haber',
      monto: '25.00',
      observacion: 'Pago aprobado',
      factura_id: 'factura-1',
    },
  ],
}

const cuentaVacia: FacturacionFamilia = {
  total_debe: '0.00',
  total_haber: '0.00',
  saldo: '0.00',
  facturas: [],
  movimientos: [],
}

function renderizarPagina() {
  return render(
    <MemoryRouter>
      <PortalFamiliaFacturacionPage />
    </MemoryRouter>,
  )
}

describe('PortalFamiliaFacturacionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedDescargarComprobante.mockResolvedValue(undefined)
  })

  it('muestra saldo, facturas, pagos y movimientos y descarga el comprobante disponible', async () => {
    mockedListarFacturacion.mockResolvedValue(facturacion)

    renderizarPagina()

    expect(await screen.findByText(/Tiziano Cabral/)).toBeInTheDocument()
    expect(screen.getByText('Saldo pendiente')).toBeInTheDocument()
    expect(screen.getAllByText('Cuota de marzo')).toHaveLength(2)
    expect(screen.getByText(/Transferencia/)).toBeInTheDocument()
    expect(screen.getByText('Pago aprobado')).toBeInTheDocument()
    expect(screen.getByText(/100,00/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Descargar comprobante' }))

    await waitFor(() => expect(mockedDescargarComprobante).toHaveBeenCalledWith('pago-1'))
  })

  it('muestra un estado vacío cuando la familia no tiene facturas', async () => {
    mockedListarFacturacion.mockResolvedValue(cuentaVacia)

    renderizarPagina()

    expect(await screen.findByText('Todavía no tenés facturas.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Descargar comprobante' })).not.toBeInTheDocument()
  })

  it('permite reintentar la consulta después de un error', async () => {
    mockedListarFacturacion.mockRejectedValueOnce(new Error('sin conexión'))
    mockedListarFacturacion.mockResolvedValueOnce(facturacion)

    renderizarPagina()

    expect(await screen.findByText('No pudimos cargar tu facturación.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText(/Tiziano Cabral/)).toBeInTheDocument()
    expect(mockedListarFacturacion).toHaveBeenCalledTimes(2)
  })
})
