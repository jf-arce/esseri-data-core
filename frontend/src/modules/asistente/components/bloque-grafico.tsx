import { useMemo } from 'react'
import { EChartsBarChart } from '@/components/ui/echarts-bar-chart'
import { EChartsLineChart } from '@/components/ui/echarts-line-chart'
import type { AliasResuelto, BloqueGrafico, BloqueTabla } from '../types'
import { datosDeGrafico, formatearEjeY } from '../utils/graficos'

const COLORES = ['var(--violeta)', 'var(--petroleo)', 'var(--exito)', 'var(--violeta-pressed)']

interface BloqueGraficoProps {
  bloque: BloqueGrafico
  /** La tabla a la que apunta `bloque.tabla_id`; si no está, no hay nada que dibujar. */
  tabla: BloqueTabla | undefined
  /** Nombres de los alias ya resueltos, para el eje cuando es una columna de personas. */
  porAlias?: Record<string, AliasResuelto>
  /** Dentro de las pestañas del bloque de datos: sin marco ni título propios. */
  incrustado?: boolean
}

export function BloqueGraficoVista({
  bloque,
  tabla,
  porAlias = {},
  incrustado = false,
}: BloqueGraficoProps) {
  const datos = useMemo(
    () => (tabla === undefined ? [] : datosDeGrafico(bloque, tabla, porAlias)),
    [bloque, tabla, porAlias],
  )
  const config = useMemo(
    () =>
      Object.fromEntries(
        bloque.series.map((clave, indice) => [
          clave,
          {
            label: tabla?.columnas.find((c) => c.clave === clave)?.etiqueta ?? clave,
            colors: { light: [COLORES[indice % COLORES.length]] },
          },
        ]),
      ),
    [bloque.series, tabla],
  )
  if (tabla === undefined || datos.length === 0) return null
  const tipoSerie = tabla.columnas.find((c) => c.clave === bloque.series[0])?.tipo ?? 'numero'
  const formatearY = (valor: unknown) => formatearEjeY(Number(valor), tipoSerie)

  return (
    <figure
      className={incrustado ? undefined : 'rounded-xl border border-borde bg-superficie p-3'}
      aria-label={bloque.titulo}
    >
      {!incrustado && (
        <figcaption className="pb-2 text-sm font-medium text-texto">{bloque.titulo}</figcaption>
      )}
      {bloque.forma === 'barras' ? (
        <EChartsBarChart
          data={datos}
          config={config}
          className="h-56 w-full"
          barRadius={4}
          barGap="20%"
          barCategoryGap={8}
        >
          <EChartsBarChart.Grid />
          <EChartsBarChart.XAxis dataKey={bloque.eje_x} hideDots />
          <EChartsBarChart.YAxis tickFormatter={formatearY} hideDots />
          {bloque.series.map((clave) => (
            <EChartsBarChart.Bar
              key={clave}
              dataKey={clave}
              variant="duotone"
              enableHoverHighlight
            />
          ))}
          <EChartsBarChart.Tooltip position="variable" />
        </EChartsBarChart>
      ) : (
        <EChartsLineChart data={datos} config={config} className="h-56 w-full">
          <EChartsLineChart.Grid />
          <EChartsLineChart.XAxis dataKey={bloque.eje_x} hideDots />
          <EChartsLineChart.YAxis tickFormatter={formatearY} hideDots />
          {bloque.series.map((clave) => (
            <EChartsLineChart.Line key={clave} dataKey={clave} strokeWidth={2} connectNulls>
              <EChartsLineChart.Dot variant="border" />
              <EChartsLineChart.ActiveDot variant="colored-border" />
            </EChartsLineChart.Line>
          ))}
          <EChartsLineChart.Tooltip position="variable" />
        </EChartsLineChart>
      )}
      <p className="pt-1 text-xs text-texto-3">
        {bloque.periodo} · {bloque.fuente}
      </p>
    </figure>
  )
}
