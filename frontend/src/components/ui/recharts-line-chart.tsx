// Adaptado de https://evilcharts.com/r/recharts-line-chart.json mediante shadcn.
// Conserva la composición Recharts; omite selección de series, zoom y efectos decorativos.
import type { ComponentProps } from 'react'
import { LineChart, Line, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer } from './recharts-chart'

export function EvilLineChart(props: ComponentProps<typeof LineChart>) {
  return (
    <ChartContainer>
      <LineChart accessibilityLayer={false} {...props} />
    </ChartContainer>
  )
}

EvilLineChart.Line = Line
EvilLineChart.Grid = CartesianGrid
EvilLineChart.XAxis = XAxis
EvilLineChart.YAxis = YAxis
