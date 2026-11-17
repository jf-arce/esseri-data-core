import '@/test/echarts-mocks'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { BloqueDatos } from '../components/bloque-datos'
import type { BloqueGrafico, BloqueTabla } from '../types'

const tabla: BloqueTabla = {
  tipo: 'tabla',
  tabla_id: 't1',
  titulo: 'Facturado y cobrado por mes',
  columnas: [
    { clave: 'mes', etiqueta: 'Mes', tipo: 'texto' },
    { clave: 'facturado', etiqueta: 'Facturado', tipo: 'numero' },
  ],
  filas: [
    { mes: '01/2026', facturado: 100 },
    { mes: '02/2026', facturado: 300 },
    { mes: '03/2026', facturado: 200 },
  ],
  periodo: '2026',
  fuente: 'Panel',
}
const grafico: BloqueGrafico = {
  tipo: 'grafico',
  tabla_id: 't1',
  titulo: tabla.titulo,
  forma: 'barras',
  eje_x: 'mes',
  series: ['facturado'],
  periodo: '2026',
  fuente: 'Panel',
}

function renderizar(conGrafico: boolean) {
  return render(
    <TooltipProvider>
      <BloqueDatos tabla={tabla} grafico={conGrafico ? grafico : undefined} porAlias={{}} />
    </TooltipProvider>,
  )
}

it('con gráfico agrupa gráfico y tabla en pestañas, con el gráfico primero', () => {
  renderizar(true)
  expect(screen.getByRole('tab', { name: 'Gráfico' })).toHaveAttribute('data-state', 'active')
  expect(screen.getByRole('tab', { name: 'Tabla' })).toHaveAttribute('data-state', 'inactive')
  expect(screen.getByRole('button', { name: 'Copiar la tabla' })).toBeInTheDocument()
})

it('sin gráfico se ve solo la tabla, sin pestañas', () => {
  renderizar(false)
  expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  expect(screen.getByText('02/2026')).toBeInTheDocument()
})

it('el orden elegido en la tabla se conserva al cambiar de pestaña', async () => {
  renderizar(true)
  const usuario = userEvent.setup()
  await usuario.click(screen.getByRole('tab', { name: 'Tabla' }))
  await usuario.click(screen.getByRole('button', { name: /Facturado/ }))
  await usuario.click(screen.getByRole('button', { name: /Facturado/ }))
  await usuario.click(screen.getByRole('tab', { name: 'Gráfico' }))
  await usuario.click(screen.getByRole('tab', { name: 'Tabla' }))
  const filas = screen.getAllByRole('row').slice(1)
  expect(filas[0]).toHaveTextContent('02/2026')
})

vi.mock('../services/exportar-tabla', () => ({ descargarTabla: vi.fn() }))
