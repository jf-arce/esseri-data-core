import './echarts-mocks'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { useDetalleDireccion } from '../../hooks/use-detalle-direccion'
import { DetalleDireccion } from '../detalle-direccion'

// El hook se mockea más abajo; la página real lo llama y pasa el resultado como prop.
function Detalle({ acceso }: { acceso: Parameters<typeof DetalleDireccion>[0]['acceso'] }) {
  return <DetalleDireccion acceso={acceso} datos={useDetalleDireccion(acceso)} />
}

interface FilaActividad {
  id: string
  categoria: 'compras' | 'finanzas' | 'alumnos'
  tipo: string
  titulo: string
  referencia: string | null
  detalle: string | null
  estado: string | null
  monto: string | null
  ocurrido_en: string
}

const compras = vi.hoisted(() => ({
  datos: [] as {
    id: string
    articulo: string
    estado: string
    fecha: string
    cantidad: number
    area_solicitante: string
  }[],
  cargando: false,
  error: null as string | null,
}))
const actividad = vi.hoisted(() => ({
  datos: [] as FilaActividad[],
  cargando: false,
  error: null as string | null,
}))
const escenario = vi.hoisted(() => ({ vacio: false }))

beforeEach(() => {
  escenario.vacio = false
  compras.datos = []
  compras.cargando = false
  compras.error = null
  actividad.datos = []
  actividad.cargando = false
  actividad.error = null
})

vi.mock('../../hooks/use-detalle-direccion', () => ({
  useDetalleDireccion: () => ({
    compras,
    deudas: { datos: { items: [], total: 0 }, cargando: false, error: null },
    finanzas: {
      datos: escenario.vacio ? [] : [{ mes: '2026-01', facturado: '1200', cobrado: '800' }],
      cargando: false,
      error: null,
    },
    asistencia: {
      datos: escenario.vacio
        ? []
        : [
            { fecha: '2026-01-12', tipo: 'presente' },
            { fecha: '2026-01-12', tipo: 'ausente_injustificado' },
          ],
      cargando: false,
      error: null,
    },
    actividad,
  }),
}))

const acceso = (
  cambios: Partial<Record<'compras' | 'finanzas' | 'academico' | 'alumnos', boolean>>,
) => ({
  compras: false,
  finanzas: false,
  academico: false,
  alumnos: false,
  ...cambios,
})

const solicitud = (indice: number, dia: string, estado = 'pendiente') => ({
  id: String(indice),
  articulo: `Artículo ${indice}`,
  estado,
  fecha: dia,
  cantidad: 1,
  area_solicitante: 'Dirección',
})

it.each([0, 1, 5, 6])(
  'explains the preview limit only above five pending requests (%i)',
  (total) => {
    compras.datos = Array.from({ length: total }, (_, index) =>
      solicitud(index, `2026-10-${String(index + 1).padStart(2, '0')}`),
    )
    render(
      <MemoryRouter>
        <Detalle acceso={acceso({ compras: true })} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: /Revisar solicitudes/ })).toHaveAttribute(
      'href',
      '/solicitudes-compra',
    )
    const columna = screen.getByRole('region', { name: 'Solicitudes de compra' })
    expect(within(columna).queryAllByRole('listitem')).toHaveLength(Math.min(total, 5))
  },
)

it('shows the financial strip, collection rate and data table instead of range selects', async () => {
  render(
    <MemoryRouter>
      <Detalle acceso={acceso({ finanzas: true })} />
    </MemoryRouter>,
  )
  const resumen = screen.getByLabelText('Resumen financiero del año')
  expect(resumen).toHaveTextContent(/Facturado del año.*1.200,00/)
  expect(resumen).toHaveTextContent(/Cobrado del año.*800,00/)
  expect(resumen).toHaveTextContent('67 %')
  expect(screen.queryByText('Consultar valores por mes')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Restablecer' })).not.toBeInTheDocument()
  expect(screen.getByRole('table', { name: 'Facturado y cobrado por mes' })).toBeVisible()
  expect(screen.getByRole('link', { name: /Abrir facturación/ })).toHaveAttribute(
    'href',
    '/facturacion',
  )
})

it('shows attendance summary and its data table', () => {
  render(
    <MemoryRouter>
      <Detalle acceso={acceso({ academico: true })} />
    </MemoryRouter>,
  )
  expect(screen.getByLabelText('Presentismo registrado')).toHaveTextContent('50%')
  expect(screen.getByLabelText('Presentismo registrado')).toHaveTextContent('1 de 2 registros')
  expect(screen.getByRole('table', { name: 'Presentismo por fecha' })).toBeVisible()
  expect(screen.getByRole('link', { name: /Ver asistencias/ })).toHaveAttribute(
    'href',
    '/academico/historial-asistencia',
  )
})

it('lists only pending requests, oldest first, with their age and no repeated status badge', () => {
  const hoy = new Date()
  const hace = (dias: number) => {
    const d = new Date(hoy)
    d.setDate(hoy.getDate() - dias)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  compras.datos = [
    solicitud(1, hace(2)),
    solicitud(2, hace(12)),
    solicitud(3, hace(30), 'aprobada'),
  ]
  render(
    <MemoryRouter>
      <Detalle acceso={acceso({ compras: true })} />
    </MemoryRouter>,
  )
  const columna = screen.getByRole('region', { name: 'Solicitudes de compra' })
  expect(within(columna).getByRole('heading', { name: /Solicitudes de compra/ })).toHaveTextContent(
    '· 2',
  )
  const filas = within(columna).getAllByRole('listitem')
  expect(filas).toHaveLength(2)
  expect(filas[0]).toHaveTextContent('Artículo 2')
  expect(filas[0]).toHaveTextContent('hace 12 días')
  expect(filas[0]).toHaveTextContent('Demorada')
  expect(filas[1]).toHaveTextContent('hace 2 días')
  expect(filas[1]).not.toHaveTextContent('Demorada')
  expect(within(columna).queryByText('Pendiente')).not.toBeInTheDocument()
})

it('makes each pending request a link and keeps the count visible', () => {
  compras.datos = [solicitud(1, '2026-10-01'), solicitud(2, '2026-10-02')]
  render(
    <MemoryRouter>
      <Detalle acceso={acceso({ compras: true })} />
    </MemoryRouter>,
  )
  const columna = screen.getByRole('region', { name: 'Solicitudes de compra' })
  for (const fila of within(columna).getAllByRole('listitem'))
    expect(within(fila).getByRole('link')).toHaveAttribute('href', '/solicitudes-compra')
  expect(screen.queryByText(/Lo más urgente primero/)).not.toBeInTheDocument()
})

it('filters the activity feed by category with tabs', async () => {
  actividad.datos = [
    {
      id: 'a',
      categoria: 'finanzas',
      tipo: 'pago_registrado',
      titulo: 'Pago registrado',
      referencia: null,
      detalle: null,
      estado: 'registrado',
      monto: null,
      ocurrido_en: '2026-01-12T15:30:00.000Z',
    },
    {
      id: 'b',
      categoria: 'compras',
      tipo: 'orden_compra_emitida',
      titulo: 'Orden de compra emitida',
      referencia: null,
      detalle: null,
      estado: 'emitida',
      monto: null,
      ocurrido_en: '2026-01-11T15:30:00.000Z',
    },
    {
      id: 'c',
      categoria: 'alumnos',
      tipo: 'matricula_alta',
      titulo: 'Alta de matrícula',
      referencia: null,
      detalle: null,
      estado: 'alta',
      monto: null,
      ocurrido_en: '2026-01-10T15:30:00.000Z',
    },
  ]
  render(
    <MemoryRouter>
      <Detalle acceso={acceso({ compras: true, finanzas: true, alumnos: true })} />
    </MemoryRouter>,
  )
  const lista = () => screen.getByRole('list', { name: 'Actividad reciente' })
  expect(within(lista()).getAllByRole('listitem')).toHaveLength(3)
  await userEvent.click(screen.getByRole('tab', { name: 'Compras' }))
  expect(within(lista()).getAllByRole('listitem')).toHaveLength(1)
  expect(within(lista()).getByText('Orden de compra emitida')).toBeVisible()
  expect(screen.getByRole('tab', { name: 'Compras' })).toHaveAttribute('aria-selected', 'true')
  await userEvent.click(screen.getByRole('tab', { name: 'Todo' }))
  expect(within(lista()).getAllByRole('listitem')).toHaveLength(3)
})

it('renders cross-module activity with its icon, state and reference', () => {
  actividad.datos = [
    {
      id: 'e1',
      categoria: 'finanzas',
      tipo: 'pago_registrado',
      titulo: 'Pago registrado',
      referencia: 'Cabral, Lorena',
      detalle: 'Transferencia',
      estado: 'registrado',
      monto: '2000.00',
      ocurrido_en: '2026-01-12T15:30:00.000Z',
    },
    {
      id: 'e2',
      categoria: 'alumnos',
      tipo: 'matricula_baja',
      titulo: 'Baja de matrícula',
      referencia: 'Cabral, Tiziano',
      detalle: 'Ciclo 2026',
      estado: 'baja',
      monto: null,
      ocurrido_en: '2026-01-11T15:30:00.000Z',
    },
  ]
  render(
    <MemoryRouter>
      <Detalle acceso={acceso({ finanzas: true, alumnos: true })} />
    </MemoryRouter>,
  )
  const lista = screen.getByRole('list', { name: 'Actividad reciente' })
  expect(within(lista).getAllByRole('listitem')).toHaveLength(2)
  expect(within(lista).getByText('Pago registrado')).toBeVisible()
  expect(within(lista).getByText('Cabral, Lorena · Transferencia · $ 2.000,00')).toBeVisible()
  expect(within(lista).getByText('Registrado')).toBeVisible()
  expect(within(lista).getByText('Baja de matrícula')).toBeVisible()
  expect(within(lista).getByText('Baja')).toBeVisible()
  expect(lista.querySelectorAll('svg')).toHaveLength(2)
  expect(within(lista).getByRole('link', { name: 'Ver pago registrado' })).toHaveAttribute(
    'href',
    '/facturacion',
  )
  expect(within(lista).getByRole('link', { name: 'Ver baja de matrícula' })).toHaveAttribute(
    'href',
    '/inscripciones',
  )
})

it('keeps compact empty and error states without presenting failed counts as zero', () => {
  compras.error = 'No se pudieron cargar las compras'
  actividad.error = 'No se pudo cargar la actividad'
  render(
    <MemoryRouter>
      <Detalle acceso={acceso({ compras: true })} />
    </MemoryRouter>,
  )
  expect(screen.getByRole('heading', { name: 'Solicitudes de compra' })).toBeInTheDocument()
  expect(screen.queryByText(/· 0/)).not.toBeInTheDocument()
  expect(screen.getAllByRole('alert')).toHaveLength(2)
})

it('shows explicit empty sections without synthetic chart values or invalid percentages', () => {
  escenario.vacio = true
  render(
    <MemoryRouter>
      <Detalle acceso={acceso({ compras: true, finanzas: true, academico: true, alumnos: true })} />
    </MemoryRouter>,
  )
  expect(screen.getByText('No hay solicitudes pendientes')).toBeInTheDocument()
  expect(screen.getByText('No hay cuentas en mora')).toBeInTheDocument()
  expect(screen.getAllByText('No hay registros para mostrar.')).toHaveLength(3)
  expect(screen.queryByLabelText('Resumen financiero del año')).not.toBeInTheDocument()
  expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument()
})
