import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { BloqueKpiVista } from '../components/bloque-kpi'
import type { BloqueKpi } from '../types'

const base: BloqueKpi = {
  tipo: 'kpi',
  titulo: 'Cobrado (total)',
  valor: 1000,
  unidad: '$',
  periodo: '2026',
  fuente: 'Panel',
}

it('sin comparación no muestra variación', () => {
  render(<BloqueKpiVista bloque={base} />)
  expect(screen.queryByText(/vs\./)).not.toBeInTheDocument()
})

it('muestra una suba con flecha y el período comparado', () => {
  render(<BloqueKpiVista bloque={{ ...base, variacion: 12.5, periodo_comparado: '2025' }} />)
  expect(screen.getByText(/▲ 12,5 %/)).toHaveClass('text-exito')
  expect(screen.getByText(/vs\. 2025/)).toBeVisible()
})

it('muestra una baja en color de error', () => {
  render(<BloqueKpiVista bloque={{ ...base, variacion: -3, periodo_comparado: '2025' }} />)
  expect(screen.getByText(/▼ 3 %/)).toHaveClass('text-error')
})

it('avisa cuando no hay base de comparación', () => {
  render(<BloqueKpiVista bloque={{ ...base, variacion: null, periodo_comparado: '2025' }} />)
  expect(screen.getByText(/Sin base de comparación/)).toBeVisible()
})
