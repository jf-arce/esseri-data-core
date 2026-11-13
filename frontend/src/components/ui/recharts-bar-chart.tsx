// Adaptado de https://evilcharts.com/r/recharts-bar-chart.json mediante shadcn.
// Conserva la composición Recharts; omite selección de series, zoom y efectos decorativos.
import type { ComponentProps } from 'react'
import { BarChart, Bar, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer } from './recharts-chart'

export function EvilBarChart(props: ComponentProps<typeof BarChart>) {
  return (
    <ChartContainer>
      <BarChart accessibilityLayer={false} {...props} />
    </ChartContainer>
  )
}

EvilBarChart.Bar = Bar
EvilBarChart.Grid = CartesianGrid
EvilBarChart.XAxis = XAxis
EvilBarChart.YAxis = YAxis
