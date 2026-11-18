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
  render(
    <BloqueKpiVista
      bloque={{ ...base, variacion: 12.5, periodo_comparado: '2025', mejora: 'alza' }}
    />,
  )
  expect(screen.getByText(/12,5 %/)).toHaveClass('bg-exito')
  expect(screen.getByText(/vs\. 2025/)).toBeVisible()
})

it('una baja donde conviene que baje se pinta como buena', () => {
  render(
    <BloqueKpiVista
      bloque={{ ...base, variacion: -3, periodo_comparado: '2025', mejora: 'baja' }}
    />,
  )
  expect(screen.getByText(/3 %/)).toHaveClass('bg-exito')
})

it('una suba donde conviene que baje se pinta como mala', () => {
  render(
    <BloqueKpiVista
      bloque={{ ...base, variacion: 8, periodo_comparado: '2025', mejora: 'baja' }}
    />,
  )
  expect(screen.getByText(/8 %/)).toHaveClass('bg-error')
})

it('sin saber hacia dónde es mejor, la variación no lleva juicio de color', () => {
  render(<BloqueKpiVista bloque={{ ...base, variacion: -3, periodo_comparado: '2025' }} />)
  const etiqueta = screen.getByText(/3 %/)
  expect(etiqueta).not.toHaveClass('bg-exito')
  expect(etiqueta).not.toHaveClass('bg-error')
})

it('avisa cuando no hay base de comparación', () => {
  render(<BloqueKpiVista bloque={{ ...base, variacion: null, periodo_comparado: '2025' }} />)
  expect(screen.getByText(/Sin base de comparación/)).toBeVisible()
  // El período comparado queda en el tooltip: no se repite como texto cuando no hay base.
  expect(screen.queryByText(/vs\./)).not.toBeInTheDocument()
})

it('contra un período en 0 muestra la cifra anterior en vez de "sin base"', () => {
  render(
    <BloqueKpiVista
      bloque={{
        ...base,
        valor: 7,
        unidad: '',
        variacion: null,
        periodo_comparado: 'octubre',
        valor_anterior: 0,
      }}
    />,
  )
  expect(screen.getByText(/Antes: 0/)).toBeVisible()
  expect(screen.queryByText(/Sin base de comparación/)).not.toBeInTheDocument()
  expect(screen.getByText(/vs\. octubre/)).toBeVisible()
})

it('muestra el importe anterior con el formato de la unidad', () => {
  render(
    <BloqueKpiVista
      bloque={{ ...base, variacion: null, periodo_comparado: '2025', valor_anterior: 1500 }}
    />,
  )
  expect(screen.getByText(/Antes: \$ 1\.500/)).toBeVisible()
})
