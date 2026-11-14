import '@/test/echarts-mocks'
import { render } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { EChartsBarChart } from '@/components/ui/echarts-bar-chart'
import { EChartsLineChart } from '@/components/ui/echarts-line-chart'
import { BloqueGraficoVista } from '../components/bloque-grafico'
import type { BloqueGrafico, BloqueTabla } from '../types'
import { datosDeGrafico, formatearEjeY } from '../utils'

const tabla: BloqueTabla = {
  tipo: 'tabla',
  tabla_id: 't1',
  titulo: 'Facturado y cobrado por mes',
  columnas: [
    { clave: 'mes', etiqueta: 'Mes', tipo: 'texto' },
    { clave: 'facturado', etiqueta: 'Facturado', tipo: 'moneda' },
    { clave: 'cobrado', etiqueta: 'Cobrado', tipo: 'moneda' },
  ],
  filas: [
    { mes: '01/2026', facturado: 100, cobrado: 80 },
    { mes: '02/2026', facturado: 120, cobrado: null },
    { mes: '03/2026', facturado: 90, cobrado: 90 },
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
  series: ['facturado', 'cobrado'],
  periodo: '2026',
  fuente: 'Panel',
}

beforeEach(() => vi.clearAllMocks())

it('toma los datos de la tabla referenciada, con null donde no hay valor', () => {
  expect(datosDeGrafico(grafico, tabla)[1]).toEqual({
    mes: '02/2026',
    facturado: 120,
    cobrado: null,
  })
})

it('dibuja barras con los datos de su tabla', () => {
  render(<BloqueGraficoVista bloque={grafico} tabla={tabla} />)
  const props = vi.mocked(EChartsBarChart).mock.calls[0][0]
  expect(props.data).toHaveLength(3)
  expect(EChartsLineChart).not.toHaveBeenCalled()
})

it('dibuja líneas cuando la forma es líneas', () => {
  render(<BloqueGraficoVista bloque={{ ...grafico, forma: 'lineas' }} tabla={tabla} />)
  expect(EChartsLineChart).toHaveBeenCalled()
  expect(EChartsBarChart).not.toHaveBeenCalled()
})

it('no dibuja nada si la tabla referenciada no está', () => {
  const { container } = render(<BloqueGraficoVista bloque={grafico} tabla={undefined} />)
  expect(container).toBeEmptyDOMElement()
})

it('formatea el eje de importes en forma compacta', () => {
  expect(formatearEjeY(1500000, 'moneda')).toMatch(/\$/)
  expect(formatearEjeY(12, 'numero')).toBe('12')
})
