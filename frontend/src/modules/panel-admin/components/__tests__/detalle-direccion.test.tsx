import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { DetalleDireccion } from '../detalle-direccion'

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

it.each([0, 1, 5, 6])(
  'explains the preview limit only above five pending requests (%i)',
  (total) => {
    compras.datos = Array.from({ length: total }, (_, index) => ({
      id: String(index),
      articulo: `Artículo ${index}`,
      estado: 'pendiente',
      fecha: `2026-10-${String(index + 1).padStart(2, '0')}`,
      cantidad: 1,
      area_solicitante: 'Dirección',
    }))
    render(
      <MemoryRouter>
        <DetalleDireccion acceso={acceso({ compras: true })} />
      </MemoryRouter>,
    )
    expect(screen.queryByText('Hasta cinco solicitudes pendientes')).not.toBeInTheDocument()
    const notice = screen.queryByText('Mostrando las 5 pendientes más recientes')
    if (total > 5) expect(notice).toBeInTheDocument()
    else expect(notice).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Revisar solicitudes' })).toHaveAttribute(
      'href',
      '/solicitudes-compra',
    )
    if (total) expect(screen.getAllByRole('row')).toHaveLength(Math.min(total, 5) + 1)
  },
)

it('shows monthly billed and collected amounts in a keyboard-accessible tooltip', async () => {
  render(
    <MemoryRouter>
      <DetalleDireccion acceso={acceso({ finanzas: true })} />
    </MemoryRouter>,
  )
  fireEvent.focus(screen.getByRole('button', { name: 'Ver valores de 2026-01' }))
  const tooltip = await screen.findByRole('tooltip')
  expect(screen.queryByText('Ver importes por mes')).not.toBeInTheDocument()
  expect(tooltip).toHaveTextContent('enero de 2026')
  expect(screen.getByText('Último mes · enero de 2026')).toBeInTheDocument()
  expect(tooltip).toHaveTextContent(/Facturado:.*1.200,00/)
  expect(tooltip).toHaveTextContent(/Cobrado:.*800,00/)
})

it('shows the attendance date, percentage and record counts in a tooltip', async () => {
  render(
    <MemoryRouter>
      <DetalleDireccion acceso={acceso({ academico: true })} />
    </MemoryRouter>,
  )
  fireEvent.focus(screen.getByRole('button', { name: 'Ver asistencia del 12/1/2026' }))
  const tooltip = await screen.findByRole('tooltip')
  expect(screen.queryByText('Ver asistencia por día')).not.toBeInTheDocument()
  expect(tooltip).toHaveTextContent('12/1/2026')
  expect(screen.getByRole('link', { name: 'Ver asistencias' })).toHaveAttribute(
    'href',
    '/academico/historial-asistencia',
  )
  expect(tooltip).toHaveTextContent('50%')
  expect(tooltip).toHaveTextContent('1 de 2 registros')
})

it('exposes chart scales and essential summaries without opening details', () => {
  render(
    <MemoryRouter>
      <DetalleDireccion acceso={acceso({ finanzas: true, academico: true })} />
    </MemoryRouter>,
  )
  expect(screen.getByLabelText('Escala financiera en pesos argentinos')).toBeVisible()
  expect(screen.getByLabelText('Escala de presentismo')).toHaveTextContent('100%')
  expect(screen.getByLabelText('Escala de presentismo')).toHaveTextContent('0%')
  expect(screen.getByLabelText('Presentismo registrado')).toHaveTextContent('50%')
  expect(screen.getByLabelText('Resumen financiero del último mes')).toHaveTextContent(/1.200,00/)
  expect(screen.getByLabelText('Resumen financiero del último mes')).toHaveTextContent(/800,00/)
  expect(screen.getAllByText('12/1/2026', { selector: 'span' })[0]).toBeVisible()
})

it('counts only pending purchases, shows their real status and never invents amounts', () => {
  compras.datos = [
    {
      id: '1',
      articulo: 'Material didáctico',
      estado: 'pendiente',
      fecha: '2026-01-12',
      cantidad: 2,
      area_solicitante: 'Inicial',
    },
    {
      id: '2',
      articulo: 'Insumos',
      estado: 'pendiente',
      fecha: '2026-01-11',
      cantidad: 1,
      area_solicitante: 'Servicios',
    },
    {
      id: '3',
      articulo: 'Resmas',
      estado: 'aprobada',
      fecha: '2026-01-10',
      cantidad: 3,
      area_solicitante: 'Primaria',
    },
  ]
  render(
    <MemoryRouter>
      <DetalleDireccion acceso={acceso({ compras: true })} />
    </MemoryRouter>,
  )
  expect(screen.getByRole('tab', { name: 'Solicitudes de compra (2)' })).toBeInTheDocument()
  const tabla = screen.getByRole('table', { name: /Solicitudes de compra pendientes/ })
  expect(within(tabla).getByRole('columnheader', { name: 'Estado' })).toBeInTheDocument()
  expect(within(tabla).queryByRole('columnheader', { name: 'Monto' })).not.toBeInTheDocument()
  expect(within(tabla).getAllByText('Pendiente')).toHaveLength(2)
  // Sin acciones por fila: la tabla solo informa, y el único acceso es el general.
  expect(within(tabla).queryByRole('link')).not.toBeInTheDocument()
  expect(within(tabla).queryByRole('columnheader', { name: 'Acciones' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Revisar solicitudes' })).toHaveAttribute(
    'href',
    '/solicitudes-compra',
  )
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
      <DetalleDireccion acceso={acceso({ finanzas: true, alumnos: true })} />
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
})

it('keeps compact empty and error states without presenting failed counts as zero', () => {
  compras.error = 'No se pudieron cargar las compras'
  actividad.error = 'No se pudo cargar la actividad'
  render(
    <MemoryRouter>
      <DetalleDireccion acceso={acceso({ compras: true })} />
    </MemoryRouter>,
  )
  expect(screen.getByRole('tab', { name: 'Solicitudes de compra' })).toBeInTheDocument()
  expect(screen.queryByRole('tab', { name: 'Solicitudes de compra (0)' })).not.toBeInTheDocument()
  expect(screen.getAllByRole('alert')).toHaveLength(2)
})

it('shows explicit empty sections without synthetic chart values or invalid percentages', () => {
  escenario.vacio = true
  render(
    <MemoryRouter>
      <DetalleDireccion
        acceso={acceso({ compras: true, finanzas: true, academico: true, alumnos: true })}
      />
    </MemoryRouter>,
  )
  expect(screen.getByRole('tab', { name: 'Solicitudes de compra (0)' })).toBeInTheDocument()
  expect(screen.getAllByText('No hay registros para mostrar.')).toHaveLength(4)
  expect(screen.queryByLabelText('Escala de presentismo')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Resumen financiero del último mes')).not.toBeInTheDocument()
  expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument()
})
