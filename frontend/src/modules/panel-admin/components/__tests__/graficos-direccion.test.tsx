import './echarts-mocks'
import { act, render, screen, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { EChartsBarChart } from '@/components/ui/echarts-bar-chart'
import { EChartsLineChart } from '@/components/ui/echarts-line-chart'
import { GraficoAsistencia, GraficoFinanciero } from '../graficos-direccion'

beforeEach(() => vi.clearAllMocks())
it('handles empty series and invalid counts without invalid percentages', () => {
  const { rerender } = render(<GraficoAsistencia serie={[]} />)
  expect(screen.getByText('No hay registros para mostrar.')).toBeVisible()
  for (const presentes of [0, -1, 5]) {
    rerender(<GraficoAsistencia serie={[['2026-01-01', { presentes, total: 0 }]]} />)
    expect(screen.getByText('No hay registros para mostrar.')).toBeVisible()
  }
  expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument()
  rerender(<GraficoFinanciero meses={[]} />)
  expect(screen.getByText('No hay registros para mostrar.')).toBeVisible()
})
it('keeps zero amounts available in an accessible table and avoids invalid percentages', async () => {
  render(<GraficoFinanciero meses={[{ mes: '2026-01', facturado: '0', cobrado: '0' }]} />)
  const tabla = screen.getByRole('table', { name: 'Facturado y cobrado por mes' })
  expect(within(tabla).getByText('enero de 2026')).toBeVisible()
  expect(within(tabla).getAllByText(/0,00/)).toHaveLength(2)
  expect(screen.getAllByText('Sin facturación')).toHaveLength(2)
  expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Desde')).not.toBeInTheDocument()
})
it('preserves calendar gaps as null, a fixed percentage scale and weighted range totals', async () => {
  render(
    <GraficoAsistencia
      serie={[
        ['2026-01-01', { presentes: 0, total: 8 }],
        ['2026-01-02', { presentes: 1, total: 2 }],
        ['2026-01-11', { presentes: 2, total: 2 }],
      ]}
    />,
  )
  const llamadas = vi.mocked(EChartsLineChart).mock.calls
  const props = llamadas.at(-1)?.[0]
  expect(props?.data).toHaveLength(11)
  expect(props?.data[2]).toMatchObject({ fecha: '2026-01-03', porcentaje: null, total: 0 })
  expect(props?.data[0]).toMatchObject({ porcentaje: 0 })
  expect(vi.mocked(EChartsLineChart.YAxis)).toHaveBeenCalledWith(
    expect.objectContaining({ min: 0, max: 100, interval: 25 }),
    undefined,
  )
  expect(screen.getByLabelText('Presentismo registrado')).toHaveTextContent('25%3 de 12 registros')
  expect(screen.getByText('Promedio diario')).toBeVisible()
  expect(screen.getByLabelText('Presentismo registrado')).toHaveTextContent('25%3 de 12 registros')
})
it('summarizes attendance with the daily average and the lowest day', () => {
  render(
    <GraficoAsistencia
      serie={[
        ['2026-01-01', { presentes: 1, total: 2 }],
        ['2026-01-02', { presentes: 2, total: 2 }],
      ]}
    />,
  )
  expect(screen.getByText('Promedio diario').nextSibling).toHaveTextContent('75 %')
  const masBajo = screen.getByText('Día más bajo').nextSibling
  expect(masBajo).toHaveTextContent('50 %')
  expect(masBajo).toHaveTextContent('1/1/2026')
})

it('exposes a single attendance point in the data table', async () => {
  render(<GraficoAsistencia serie={[['2026-01-01', { presentes: 1, total: 1 }]]} />)
  const tabla = screen.getByRole('table', { name: 'Presentismo por fecha' })
  expect(within(tabla).getByText('1/1/2026')).toBeVisible()
  expect(within(tabla).getByText('100 %')).toBeVisible()
  expect(within(tabla).getByText('1 de 1')).toBeVisible()
})

it.each([
  [['100', '95'], 'En meta'],
  [['100', '50'], 'Bajo meta'],
])('shows the collection rate badge for %j', (montos, etiqueta) => {
  render(
    <GraficoFinanciero meses={[{ mes: '2026-01', facturado: montos[0], cobrado: montos[1] }]} />,
  )
  expect(screen.getByText(etiqueta)).toBeVisible()
  expect(screen.getByText('Cobranza', { selector: 'dt' }).nextSibling).toHaveTextContent(
    `${montos[1]} %`,
  )
})

it('compares the latest collected amount against the previous month with text, not only color', () => {
  const { rerender } = render(
    <GraficoFinanciero
      meses={[
        { mes: '2026-01', facturado: '100', cobrado: '100' },
        { mes: '2026-02', facturado: '100', cobrado: '150' },
      ]}
    />,
  )
  expect(screen.getByText('Cobrado vs. mes anterior').nextSibling).toHaveTextContent('▲ 50 % más')
  rerender(
    <GraficoFinanciero
      meses={[
        { mes: '2026-01', facturado: '100', cobrado: '100' },
        { mes: '2026-02', facturado: '100', cobrado: '50' },
      ]}
    />,
  )
  expect(screen.getByText('Cobrado vs. mes anterior').nextSibling).toHaveTextContent('▼ 50 % menos')
  rerender(<GraficoFinanciero meses={[{ mes: '2026-01', facturado: '100', cobrado: '50' }]} />)
  expect(screen.getByText('Sin base de comparación')).toBeVisible()
})

it('opens the whole interval when loading resolves', () => {
  const { rerender } = render(<GraficoAsistencia serie={[]} cargando />)
  rerender(
    <GraficoAsistencia
      serie={[
        ['2026-01-01', { presentes: 0, total: 1 }],
        ['2026-01-11', { presentes: 9, total: 9 }],
      ]}
    />,
  )
  expect(screen.getByLabelText('Presentismo registrado')).toHaveTextContent('90%9 de 10 registros')
})

it('summarizes the zoomed interval with labelled amounts and its collection rate', () => {
  render(
    <GraficoFinanciero
      meses={[
        { mes: '2026-01', facturado: '100', cobrado: '50' },
        { mes: '2026-02', facturado: '300', cobrado: '200' },
      ]}
    />,
  )
  const brush = vi
    .mocked(EChartsBarChart.Brush)
    .mock.calls.map(([props]) => props)
    .find((props) => 'onChange' in props)
  act(() => brush?.onChange?.({ startIndex: 1, endIndex: 1 }))
  const resumen = screen.getByLabelText('Resumen del intervalo seleccionado')
  expect(resumen).toHaveTextContent(/feb.*2026.*\(1 mes\)/)
  expect(resumen).toHaveTextContent(/Facturado.*300,00/)
  expect(resumen).toHaveTextContent(/Cobrado.*200,00/)
  expect(resumen).toHaveTextContent('67 %')
})

it('offers range shortcuts that zoom the chart and summarize the interval', async () => {
  const meses = Array.from({ length: 8 }, (_, i) => ({
    mes: `2026-${String(i + 1).padStart(2, '0')}`,
    facturado: '100',
    cobrado: '80',
  }))
  render(<GraficoFinanciero meses={meses} />)
  expect(screen.getByRole('button', { name: 'Todo' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByLabelText('Resumen del intervalo seleccionado')).toHaveTextContent('(8 meses)')
  await userEvent.click(screen.getByRole('button', { name: '3 meses' }))
  expect(screen.getByRole('button', { name: '3 meses' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByLabelText('Resumen del intervalo seleccionado')).toHaveTextContent(
    /\(3 meses\).*Facturado.*Cobrado/,
  )
})
