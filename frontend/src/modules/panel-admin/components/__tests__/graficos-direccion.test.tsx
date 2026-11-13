import './echarts-mocks'
import { render, screen, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
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
it('keeps zero amounts available through a keyboard-accessible detail', async () => {
  render(<GraficoFinanciero meses={[{ mes: '2026-01', facturado: '0', cobrado: '0' }]} />)
  await userEvent.click(screen.getByText('Consultar valores por mes'))
  expect(screen.getByLabelText('Mes a consultar')).toHaveDisplayValue('enero de 2026')
  expect(screen.getByText(/Facturado:.*0,00.*Cobrado:.*0,00/)).toBeVisible()
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
  await userEvent.selectOptions(screen.getByLabelText('Desde'), '1')
  expect(screen.getByLabelText('Presentismo registrado')).toHaveTextContent('75%3 de 4 registros')
  await userEvent.selectOptions(screen.getByLabelText('Hasta'), '5')
  await userEvent.selectOptions(screen.getByLabelText('Desde'), '2')
  expect(screen.getByLabelText('Presentismo registrado')).toHaveTextContent('Sin registros')
  await userEvent.click(screen.getByRole('button', { name: 'Restablecer' }))
  expect(screen.getByLabelText('Presentismo registrado')).toHaveTextContent('25%3 de 12 registros')
})
it('exposes a single attendance point and its counts', async () => {
  render(<GraficoAsistencia serie={[['2026-01-01', { presentes: 1, total: 1 }]]} />)
  await userEvent.click(screen.getByText('Consultar valores por fecha'))
  expect(screen.getByLabelText('Fecha a consultar')).toHaveDisplayValue('1/1/2026')
  expect(screen.getByText('Presentismo: 100% · 1 de 1 registros')).toBeVisible()
})
it('shows financial interval sums without changing the latest-month summary', async () => {
  render(
    <GraficoFinanciero
      meses={[
        { mes: '2026-01', facturado: '100', cobrado: '50' },
        { mes: '2026-02', facturado: '300', cobrado: '200' },
      ]}
    />,
  )
  await userEvent.selectOptions(screen.getByLabelText('Hasta'), '0')
  expect(screen.getByText(/Total del intervalo/)).toHaveTextContent(
    /Facturado:.*100,00.*Cobrado:.*50,00/,
  )
  expect(
    within(screen.getByLabelText('Resumen financiero del último mes')).getByText(/300,00/),
  ).toBeVisible()
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
  expect(screen.getByLabelText('Hasta')).toHaveValue('10')
  expect(screen.getByRole('button', { name: 'Restablecer' })).toBeDisabled()
})
