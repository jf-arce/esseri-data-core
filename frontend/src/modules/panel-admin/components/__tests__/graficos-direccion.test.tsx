import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import { GraficoAsistencia, GraficoFinanciero } from '../graficos-direccion'

it('handles empty series and days without records without invalid percentages', () => {
  const { rerender } = render(<GraficoAsistencia serie={[]} />)
  expect(screen.getByText('No hay registros para mostrar.')).toBeVisible()
  rerender(<GraficoAsistencia serie={[['2026-01-01', { presentes: 0, total: 0 }]]} />)
  expect(screen.getByText('No hay registros para mostrar.')).toBeVisible()
  expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument()
  rerender(<GraficoFinanciero meses={[]} />)
  expect(screen.getByText('No hay registros para mostrar.')).toBeVisible()
})

it('shows zero amounts on touch/click and dismisses the detail with Escape', async () => {
  render(<GraficoFinanciero meses={[{ mes: '2026-01', facturado: '0', cobrado: '0' }]} />)
  await userEvent.click(screen.getByRole('button', { name: 'Ver valores de 2026-01' }))
  expect(await screen.findByRole('tooltip')).toHaveTextContent(/Facturado:.*0,00.*Cobrado:.*0,00/)
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Resumen financiero del último mes')).toHaveTextContent(/0,00/)
})

it('keeps true temporal spacing, zero attendance and the weighted summary', async () => {
  render(
    <GraficoAsistencia
      serie={[
        ['2026-01-01', { presentes: 0, total: 2 }],
        ['2026-01-02', { presentes: 1, total: 2 }],
        ['2026-01-11', { presentes: 2, total: 2 }],
      ]}
    />,
  )
  expect(screen.getByRole('button', { name: 'Ver asistencia del 2/1/2026' })).toHaveStyle({
    left: '10%',
    top: '50%',
  })
  expect(screen.getByLabelText('Escala de presentismo')).toHaveTextContent('100%75%50%25%0%')
  expect(screen.getByLabelText('Presentismo registrado')).toHaveTextContent('50%3 de 6 registros')
  fireEvent.click(screen.getByRole('button', { name: 'Ver asistencia del 1/1/2026' }))
  expect(await screen.findByRole('tooltip')).toHaveTextContent('Presentismo: 0%0 de 2 registros')
  expect(screen.getByText('Los días sin registros no se consideran ausencias.')).toBeVisible()
})

it('centers a single attendance point and exposes its values through keyboard focus', async () => {
  render(<GraficoAsistencia serie={[['2026-01-01', { presentes: 1, total: 1 }]]} />)
  const point = screen.getByRole('button', { name: 'Ver asistencia del 1/1/2026' })
  expect(point).toHaveStyle({ left: '50%' })
  fireEvent.focus(point)
  expect(await screen.findByRole('tooltip')).toHaveTextContent('100%1 de 1 registros')
})
