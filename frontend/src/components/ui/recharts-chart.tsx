// Adaptado del registro EvilCharts: contenedor responsive, sin variantes decorativas.
import type { ComponentProps } from 'react'
import { ResponsiveContainer } from 'recharts'
import { motion, useReducedMotion } from 'motion/react'

export function ChartContainer({
  children,
}: Pick<ComponentProps<typeof ResponsiveContainer>, 'children'>) {
  const reducedMotion = useReducedMotion()
  return (
    <motion.div
      className="h-full min-w-0 text-xs"
      initial={reducedMotion ? false : { opacity: 0.4 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reducedMotion ? 0 : 0.4, ease: 'easeOut' }}
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={{ width: 320, height: 160 }}
      >
        {children}
      </ResponsiveContainer>
    </motion.div>
  )
}
