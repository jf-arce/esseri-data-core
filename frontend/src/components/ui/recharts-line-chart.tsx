// Adaptado de https://evilcharts.com/r/recharts-line-chart.json mediante shadcn.
// Revelado horizontal mediante la máscara de Motion de EvilCharts.
import { useId, type ComponentProps } from 'react'
import { LineChart, Line, CartesianGrid, XAxis, YAxis, ReferenceLine } from 'recharts'
import { motion, useReducedMotion } from 'motion/react'
import { ChartContainer } from './recharts-chart'

function AnimatedLine(props: ComponentProps<typeof Line>) {
  const id = useId().replace(/:/g, '')
  const reducedMotion = useReducedMotion()
  return (
    <>
      <Line
        {...props}
        isAnimationActive={false}
        style={reducedMotion ? undefined : { mask: `url(#${id})` }}
      />
      {!reducedMotion && (
        <defs>
          <mask id={id} maskUnits="userSpaceOnUse" x="-1%" y="-10%" width="102%" height="120%">
            <motion.rect
              x="-1%"
              y="-10%"
              width="102%"
              height="120%"
              fill="white"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.4, ease: [0, 0.7, 0.5, 1] }}
              style={{ originX: 0 }}
            />
          </mask>
        </defs>
      )}
    </>
  )
}

export function EvilLineChart(props: ComponentProps<typeof LineChart>) {
  return (
    <ChartContainer>
      <LineChart accessibilityLayer={false} {...props} />
    </ChartContainer>
  )
}

EvilLineChart.Line = AnimatedLine
EvilLineChart.ReferenceLine = ReferenceLine
EvilLineChart.Grid = CartesianGrid
EvilLineChart.XAxis = XAxis
EvilLineChart.YAxis = YAxis
