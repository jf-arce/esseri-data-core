// Adaptado del registro EvilCharts: contenedor responsive, sin variantes decorativas.
import { useRef, type ComponentProps } from 'react'
import { ResponsiveContainer } from 'recharts'
import { useInView, useReducedMotion } from 'motion/react'

export function ChartContainer({
  children,
}: Pick<ComponentProps<typeof ResponsiveContainer>, 'children'>) {
  const ref = useRef<HTMLDivElement>(null)
  const visible = useInView(ref, { once: true, amount: 0.25 })
  const reducedMotion = useReducedMotion()
  return (
    <div ref={ref} className="h-full min-w-0 text-xs">
      {(visible || reducedMotion) && (
        <ResponsiveContainer
          width="100%"
          height="100%"
          initialDimension={{ width: 320, height: 160 }}
        >
          {children}
        </ResponsiveContainer>
      )}
    </div>
  )
}
