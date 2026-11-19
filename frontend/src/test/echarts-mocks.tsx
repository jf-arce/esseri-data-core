import type { ReactNode } from 'react'
import { vi } from 'vitest'

// JSDOM no implementa canvas. Se comprueba el contrato con el motor; la interacción
// nativa de ECharts se verifica en navegador real.
vi.mock('@/components/ui/echarts-bar-chart', () => {
  const parte = vi.fn(() => null)
  return {
    EChartsBarChart: Object.assign(
      vi.fn(({ children }: { children?: ReactNode }) => <>{children}</>),
      {
        Bar: parte,
        Grid: parte,
        XAxis: parte,
        YAxis: parte,
        Tooltip: parte,
        Legend: parte,
        Brush: parte,
      },
    ),
  }
})
vi.mock('@/components/ui/echarts-line-chart', () => {
  const parte = vi.fn(() => null)
  return {
    EChartsLineChart: Object.assign(
      vi.fn(({ children }: { children?: ReactNode }) => <>{children}</>),
      {
        Line: parte,
        Dot: parte,
        ActiveDot: parte,
        Grid: parte,
        XAxis: parte,
        YAxis: parte,
        Tooltip: parte,
        Legend: parte,
        Brush: parte,
      },
    ),
  }
})
