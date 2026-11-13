// Adaptado de https://evilcharts.com/r/recharts-bar-chart.json mediante shadcn.
// Crecimiento desde la base con Motion, sin gradientes, zoom ni selección de series.
import { useState, type ComponentProps } from 'react'
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Cell, type BarShapeProps } from 'recharts'
import { motion, useReducedMotion } from 'motion/react'
import { ChartContainer } from './recharts-chart'

function GrowingBar({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  fill,
  fillOpacity = 1,
  revealed,
  onRevealComplete,
}: { revealed: boolean; onRevealComplete: () => void } & Partial<
  Pick<BarShapeProps, 'x' | 'y' | 'width' | 'height' | 'fill' | 'fillOpacity'>
>) {
  const reducedMotion = useReducedMotion()
  return (
    <motion.rect
      x={x}
      y={y}
      width={width}
      height={height}
      rx={2}
      fill={fill}
      initial={reducedMotion || revealed ? false : { scaleY: 0 }}
      onAnimationComplete={onRevealComplete}
      animate={{ scaleY: 1, opacity: fillOpacity }}
      transition={{
        scaleY: { duration: reducedMotion ? 0 : 0.4, ease: [0, 0.7, 0.5, 1] },
        opacity: { duration: reducedMotion ? 0 : 0.15 },
      }}
      style={{ originY: 1 }}
    />
  )
}

function AnimatedBar(props: ComponentProps<typeof Bar>) {
  // Recharts puede remontar las formas al redimensionar; la entrada pertenece a la serie.
  const [revealed, setRevealed] = useState(false)
  return (
    <Bar
      {...props}
      isAnimationActive={false}
      shape={<GrowingBar revealed={revealed} onRevealComplete={() => setRevealed(true)} />}
    />
  )
}

export function EvilBarChart(props: ComponentProps<typeof BarChart>) {
  return (
    <ChartContainer>
      <BarChart accessibilityLayer={false} {...props} />
    </ChartContainer>
  )
}

EvilBarChart.Bar = AnimatedBar
EvilBarChart.Cell = Cell
EvilBarChart.Grid = CartesianGrid
EvilBarChart.XAxis = XAxis
EvilBarChart.YAxis = YAxis
