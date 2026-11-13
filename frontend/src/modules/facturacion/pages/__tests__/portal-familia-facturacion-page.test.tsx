import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PortalFamiliaFacturacionPage } from '@/modules/facturacion/pages/portal-familia-facturacion-page'
import { descargarComprobantePagoFamilia } from '@/modules/facturacion/services/descargar-comprobante-pago-familia'
import { listarFacturacionFamilia } from '@/modules/facturacion/services/listar-facturacion-familia'
import {
  descargarFacturaFamilia,
  compartirFacturaFamilia,
} from '@/modules/facturacion/services/factura-pdf-familia'
import type { FacturacionFamilia } from '@/modules/facturacion/types'

vi.mock('@/modules/facturacion/services/descargar-comprobante-pago-familia')
vi.mock('@/modules/facturacion/services/listar-facturacion-familia')
vi.mock('@/modules/facturacion/services/factura-pdf-familia')

const mockedDescargarComprobante = vi.mocked(descargarComprobantePagoFamilia)
const mockedListarFacturacion = vi.mocked(listarFacturacionFamilia)

const facturacion: FacturacionFamilia = {
  total_debe: '125.00',
  total_haber: '25.00',
  saldo: '100.00',
  facturas: [
    {
      id: 'factura-1',
      alumno_id: 'alumno-1',
      fecha_emision: '2026-03-01',
      fecha_vencimiento: '2026-03-10',
      fecha_vencimiento_efectiva: '2026-03-10',
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
  it('preselecciona el alumno desde el atajo de la ficha', async () => {
    const cuenta = structuredClone(facturacion)
    const base = cuenta.facturas[0]
    cuenta.facturas = [
      { ...base, id: 'a1', alumno_id: 'a', alumno_nombre: 'Ana', detalles: [{ descripcion: 'Cuota Ana', monto: '125.00' }] },
      { ...base, id: 'b1', alumno_id: 'b', alumno_nombre: 'Bea', detalles: [{ descripcion: 'Cuota Bea', monto: '125.00' }] },
    ]
    mockedListarFacturacion.mockResolvedValue(cuenta)
    render(
      <MemoryRouter initialEntries={['/familia/facturacion?alumno=a']}>
        <PortalFamiliaFacturacionPage />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Cuota Ana')).toBeInTheDocument()
    expect(screen.queryByText('Cuota Bea')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Alumno: Ana/ })).toBeInTheDocument()
  })

  it('ordena las facturas por vencimiento o emisión', async () => {
    mockedListarFacturacion.mockResolvedValue({
      ...facturacion,
      facturas: [
        {
          ...facturacion.facturas[0],
          id: 'factura-abril',
          fecha_emision: '2026-04-01',
          fecha_vencimiento: '2026-04-10',
          fecha_vencimiento_efectiva: '2026-04-10',
          detalles: [{ descripcion: 'Cuota de abril', monto: '125.00' }],
        },
        {
          ...facturacion.facturas[0],
          id: 'factura-marzo',
          detalles: [{ descripcion: 'Cuota de marzo', monto: '125.00' }],
        },
      ],
    })
    render(
      <MemoryRouter>
        <PortalFamiliaFacturacionPage />
      </MemoryRouter>,
    )
    const primero = async () =>
      (await screen.findAllByText(/Cuota de (marzo|abril)/))[0].textContent ?? ''
    expect(await primero()).toContain('marzo')

    fireEvent.click(screen.getByRole('button', { name: /Ordenar:/ }))
    fireEvent.click(screen.getByRole('radio', { name: 'Vencimiento (más lejano)' }))
    await waitFor(async () => expect(await primero()).toContain('abril'))

    fireEvent.click(screen.getByRole('button', { name: /Ordenar:/ }))
    fireEvent.click(screen.getByRole('radio', { name: 'Emisión (más reciente)' }))
    await waitFor(async () => expect(await primero()).toContain('abril'))
  })


  it('shows the automatic debit label without exposing the internal payment code', async () => {
    const cuenta = structuredClone(facturacion)
    cuenta.facturas[0].pagos[0].metodo_pago = 'debito_directo'
    mockedListarFacturacion.mockResolvedValue(cuenta)

    renderizarPagina()

    expect(await screen.findByText(/Débito automático/)).toBeInTheDocument()
    expect(screen.queryByText(/debito_directo/)).not.toBeInTheDocument()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockedDescargarComprobante.mockResolvedValue(undefined)
  })

  it('muestra saldo, facturas, pagos y movimientos y descarga el comprobante disponible', async () => {
    mockedListarFacturacion.mockResolvedValue(facturacion)

    renderizarPagina()

    expect(await screen.findByText(/Tiziano Cabral/)).toBeInTheDocument()
    fireEvent.click(screen.getAllByText('Cuota de marzo')[0])
    expect(screen.getByText('Saldo pendiente')).toBeInTheDocument()
    expect(screen.getAllByText('Cuota de marzo')).toHaveLength(1)
    expect(screen.queryByRole('heading', { name: 'Conceptos' })).not.toBeInTheDocument()
    expect(screen.getByText('Pago registrado')).toBeInTheDocument()
    expect(screen.queryByText('Acreditado')).not.toBeInTheDocument()
    expect(screen.getByText(/Transferencia/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Estado de cuenta' })).not.toBeInTheDocument()
    expect(screen.getByText(/\$\s100$/)).toBeInTheDocument()
    expect(screen.getByText(/\$\s125 vencido$/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Descargar comprobante' }))

    await waitFor(() => expect(mockedDescargarComprobante).toHaveBeenCalledWith('pago-1'))
  })

  it('muestra centavos solo cuando el importe tiene decimales distintos de cero', async () => {
    const cuenta = structuredClone(facturacion)
    cuenta.facturas[0].detalles[0].monto = '125.50'
    cuenta.facturas[0].detalles.push({ descripcion: 'Otro concepto', monto: '1.00' })
    mockedListarFacturacion.mockResolvedValue(cuenta)
    renderizarPagina()
    fireEvent.click((await screen.findAllByText('Cuota de marzo'))[0])
    expect(await screen.findByText(/\$\s125,50$/)).toBeInTheDocument()
    expect(screen.getByText(/\$\s100$/)).toBeInTheDocument()
  })

  it('permite descargar y compartir el PDF de cada factura', async () => {
    mockedListarFacturacion.mockResolvedValue(facturacion)
    vi.mocked(descargarFacturaFamilia).mockResolvedValue(undefined)
    vi.mocked(compartirFacturaFamilia).mockResolvedValue(undefined)
    renderizarPagina()
    fireEvent.click((await screen.findAllByText('Cuota de marzo'))[0])
    fireEvent.click(await screen.findByRole('button', { name: 'Descargar factura' }))
    await waitFor(() => expect(descargarFacturaFamilia).toHaveBeenCalledWith('factura-1'))
    fireEvent.click(screen.getByRole('button', { name: 'Compartir factura' }))
    await waitFor(() => expect(compartirFacturaFamilia).toHaveBeenCalledWith('factura-1'))
  })

  it('ubica las acciones de factura al final y alineadas a la derecha', async () => {
    mockedListarFacturacion.mockResolvedValue(facturacion)
    renderizarPagina()
    fireEvent.click((await screen.findAllByText('Cuota de marzo'))[0])
    const descarga = screen.getByRole('button', { name: 'Descargar factura' })
    const comprobante = screen.getByRole('button', { name: 'Descargar comprobante' })
    expect(
      comprobante.compareDocumentPosition(descarga) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(descarga.parentElement).toHaveClass('justify-end')
  })

  it('oculta el detalle hasta desplegar la factura y pagina de a diez', async () => {
    const cuenta = structuredClone(facturacion)
    cuenta.facturas = Array.from({ length: 11 }, (_, indice) => ({
      ...structuredClone(facturacion.facturas[0]),
      id: String(indice + 1).padStart(8, '0'),
      detalles: [{ descripcion: `Concepto ${indice + 1}`, monto: '125.00' }],
    }))
    mockedListarFacturacion.mockResolvedValue(cuenta)
    renderizarPagina()
    expect((await screen.findAllByText('Concepto 1'))[0]).toBeInTheDocument()
    expect(screen.getAllByText('Concepto 10')[0]).toBeInTheDocument()
    expect(screen.queryByText('Concepto 11')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Descargar factura' })[0]).not.toBeVisible()
    fireEvent.click(screen.getAllByText('Concepto 1')[0])
    expect(screen.getAllByRole('button', { name: 'Descargar factura' })[0]).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getAllByText('Concepto 11')[0]).toBeInTheDocument()
    expect(screen.queryByText('Concepto 1')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Todas 11' }))
    expect(screen.getAllByText('Concepto 1')[0]).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    expect(screen.getAllByText('Concepto 1')[0]).toBeInTheDocument()
  })

  it('ordena por urgencia y filtra por estado y alumno', async () => {
    const cuenta = structuredClone(facturacion)
    const base = cuenta.facturas[0]
    cuenta.facturas = [
      {
        ...base,
        id: 'paid',
        alumno_id: 'a',
        alumno_nombre: 'Ana',
        estado: 'pagada',
        detalles: [{ descripcion: 'Cuota cancelada', monto: '125.00' }],
        fecha_vencimiento_efectiva: '2020-01-01',
      },
      {
        ...base,
        id: 'pending',
        alumno_id: 'b',
        alumno_nombre: 'Bea',
        estado: 'pendiente',
        detalles: [{ descripcion: 'Futura', monto: '125.00' }],
        fecha_vencimiento_efectiva: '2099-01-01',
      },
      {
        ...base,
        id: 'overdue',
        alumno_id: 'a',
        alumno_nombre: 'Ana',
        estado: 'pendiente',
        detalles: [{ descripcion: 'Atrasada', monto: '125.00' }],
        fecha_vencimiento_efectiva: '2020-01-01',
      },
    ]
    mockedListarFacturacion.mockResolvedValue(cuenta)
    renderizarPagina()
    const atrasada = (await screen.findAllByText('Atrasada'))[0]
    expect(
      atrasada.compareDocumentPosition(screen.getAllByText('Futura')[0]) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Pagadas 1' }))
    expect(screen.getAllByText('Cuota cancelada').length).toBeGreaterThan(0)
    expect(screen.queryByText('Futura')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Alumno' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Bea' }))
    expect(screen.getByText('No hay facturas para los filtros seleccionados.')).toBeInTheDocument()
  })

  it('muestra el débito próximo y no muestra pago parcial', async () => {
    const cuenta = structuredClone(facturacion)
    const hoy = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
    const vence = new Date(`${hoy}T00:00:00Z`)
    vence.setUTCDate(vence.getUTCDate() + 7)
    cuenta.facturas[0].fecha_vencimiento_efectiva = vence.toISOString().slice(0, 10)
    cuenta.facturas[0].pagos.push({
      ...cuenta.facturas[0].pagos[0],
      id: 'revision',
      estado: 'pendiente',
      monto: '90.00',
    })
    mockedListarFacturacion.mockResolvedValue(cuenta)
    renderizarPagina()
    expect(await screen.findByText(/Se debita el/)).toBeInTheDocument()
    expect(screen.queryByText(/Pago parcial/)).not.toBeInTheDocument()
  })

  it('permite buscar por nombre o identificador y filtrar por rango de fechas', async () => {
    const cuenta = structuredClone(facturacion)
    cuenta.facturas = [
      {
        ...cuenta.facturas[0],
        id: 'abc12345',
        alumno_nombre: 'Ana Pérez',
        fecha_vencimiento_efectiva: '2026-03-10',
      },
      {
        ...cuenta.facturas[0],
        id: 'def67890',
        alumno_nombre: 'Bea López',
        fecha_vencimiento_efectiva: '2026-04-10',
      },
    ]
    mockedListarFacturacion.mockResolvedValue(cuenta)
    renderizarPagina()
    await screen.findByText(/Ana Pérez/)
    fireEvent.click(screen.getByText('Más filtros'))
    expect(screen.getByLabelText('Desde')).toHaveValue('')
    expect(screen.getByLabelText('Hasta')).toHaveValue('')
    fireEvent.change(screen.getByLabelText('Buscar por nombre o ID'), {
      target: { value: 'def678' },
    })
    expect(screen.getByText(/Bea López/)).toBeInTheDocument()
    expect(screen.queryByText(/Ana Pérez/)).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Buscar por nombre o ID'), { target: { value: 'ana' } })
    expect(screen.getByText(/Ana Pérez/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Buscar por nombre o ID'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-04-01' } })
    expect(screen.getByText(/Bea López/)).toBeInTheDocument()
    expect(screen.queryByText(/Ana Pérez/)).not.toBeInTheDocument()
  })

  it('busca sin distinguir tildes ni mayúsculas', async () => {
    const cuenta = structuredClone(facturacion)
    cuenta.facturas = [
      {
        ...cuenta.facturas[0],
        id: 'aaa11111',
        alumno_id: 'a',
        alumno_nombre: 'Ana Pérez',
        detalles: [{ descripcion: 'Cuota de marzo', monto: '125.00' }],
      },
      {
        ...cuenta.facturas[0],
        id: 'bbb22222',
        alumno_id: 'b',
        alumno_nombre: 'Bea Lopez',
        detalles: [{ descripcion: 'Cuota de abril', monto: '125.00' }],
      },
    ]
    mockedListarFacturacion.mockResolvedValue(cuenta)
    renderizarPagina()
    await screen.findByText(/Ana Pérez/)
    fireEvent.click(screen.getByText('Más filtros'))
    const campo = screen.getByLabelText('Buscar por nombre o ID')

    fireEvent.change(campo, { target: { value: 'perez' } })
    expect(screen.getByText(/Ana Pérez/)).toBeInTheDocument()
    expect(screen.queryByText(/Bea Lopez/)).not.toBeInTheDocument()

    fireEvent.change(campo, { target: { value: 'LÓPEZ' } })
    expect(screen.getByText(/Bea Lopez/)).toBeInTheDocument()
    expect(screen.queryByText(/Ana Pérez/)).not.toBeInTheDocument()
  })

  it('muestra chips con contador y mantiene los filtros avanzados colapsados', async () => {
    mockedListarFacturacion.mockResolvedValue(facturacion)
    renderizarPagina()
    expect(await screen.findByRole('button', { name: 'Todas 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vencidas 1' })).toBeInTheDocument()
    expect(screen.getByText('Más filtros').closest('details')).not.toHaveAttribute('open')
  })

  it('avisa el débito de hoy o mañana y muestra rechazo solo cuando el dato existe', async () => {
    const cuenta = structuredClone(facturacion)
    const hoy = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
    const manana = new Date(`${hoy}T00:00:00Z`)
    manana.setUTCDate(manana.getUTCDate() + 1)
    cuenta.facturas = [
      {
        ...cuenta.facturas[0],
        id: 'hoy',
        fecha_vencimiento_efectiva: hoy,
        detalles: [{ descripcion: 'Hoy', monto: '125.00' }],
        pagos: [],
      },
      {
        ...cuenta.facturas[0],
        id: 'manana',
        fecha_vencimiento_efectiva: manana.toISOString().slice(0, 10),
        detalles: [{ descripcion: 'Mañana', monto: '125.00' }],
        pagos: [],
      },
      {
        ...cuenta.facturas[0],
        id: 'rechazo',
        fecha_vencimiento_efectiva: '2020-01-01',
        detalles: [{ descripcion: 'Atrasada', monto: '125.00' }],
        pagos: [
          { ...cuenta.facturas[0].pagos[0], metodo_pago: 'debito_directo', estado: 'rechazado' },
        ],
      },
    ]
    mockedListarFacturacion.mockResolvedValue(cuenta)
    renderizarPagina()
    expect(await screen.findByText(/Se debita hoy/)).toBeInTheDocument()
    expect(screen.getByText(/Se debita mañana/)).toBeInTheDocument()
    expect(screen.getByText(/Próximo débito: hoy/)).toBeInTheDocument()
    expect(screen.getByText(/vencido$/)).toBeInTheDocument()
    expect(screen.getByText('Débito rechazado')).toBeInTheDocument()
    const atrasada = screen.getAllByText('Atrasada')[0].closest('details')!
    fireEvent.click(within(atrasada).getByText('Débito rechazado'))
    expect(within(atrasada).getByRole('link', { name: 'Comunicaciones' })).toHaveAttribute(
      'href',
      '/familia/comunicaciones',
    )
    expect(within(atrasada).queryByText(/Revisá tu medio de pago/)).not.toBeInTheDocument()
    const sinPagos = screen.getAllByText('Hoy')[0].closest('details')!
    expect(sinPagos.querySelector('[data-slot="card-content"]')).toHaveClass('pb-5')
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

it('muestra las facturas aunque el backend omita el vencimiento efectivo', async () => {
  const incompleta = structuredClone(facturacion) as unknown as {
    facturas: Record<string, unknown>[]
  }
  delete incompleta.facturas[0].fecha_vencimiento_efectiva
  mockedListarFacturacion.mockResolvedValue(incompleta as unknown as FacturacionFamilia)

  renderizarPagina()

  expect(await screen.findByText(/Tiziano Cabral/)).toBeInTheDocument()
  expect(screen.getAllByText('Cuota de marzo').length).toBeGreaterThan(0)
})
