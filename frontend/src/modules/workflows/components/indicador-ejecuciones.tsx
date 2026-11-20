import { Link } from 'react-router'
import { ActivityIcon } from 'lucide-react'
import { StatTile } from '@/components/stat-tile'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EChartsLineChart } from '@/components/ui/echarts-line-chart'
import { RUTA_EJECUCIONES } from '@/modules/workflows/constants'
import type { EstadoEjecucion, ResumenWorkflows } from '@/modules/workflows/types'
import { ETIQUETA_ESTADO_EJECUCION } from '@/modules/workflows/utils'
import { textoVariacion } from '@/modules/workflows/utils-mapa'

const ESTADOS: EstadoEjecucion[] = ['exitoso', 'fallido', 'pendiente', 'rechazado']
const CONFIG_SERIE = { total: { label: 'Ejecuciones', colors: { light: ['var(--violeta)'] } } }

function fechaCorta(dia: string): string {
  return new Date(`${dia}T12:00:00`).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'numeric',
  })
}

interface IndicadorEjecucionesProps {
  resumen: ResumenWorkflows | null
  cargando: boolean
}

/** Dato principal de la página (§10 DESIGN.md): ejecuciones del período con su variación, el
 * desglose por estado (cada uno lleva a Ejecuciones ya filtrado) y la línea diaria. */
export function IndicadorEjecuciones({ resumen, cargando }: IndicadorEjecucionesProps) {
  const dias = resumen?.dias ?? 30
  const serie = (resumen?.serie_diaria ?? []).map((punto) => ({
    fecha: punto.fecha,
    total: punto.total,
  }))
  return (
    <section aria-label="Ejecuciones" className="grid gap-4 xl:grid-cols-[minmax(300px,380px)_1fr]">
      <StatTile
        hero
        label={`Ejecuciones, últimos ${dias} días`}
        value={resumen?.actual.total ?? 0}
        icon={ActivityIcon}
        note={resumen ? textoVariacion(resumen.actual, resumen.anterior, dias) : undefined}
        cargando={cargando}
      >
        {resumen && (
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-borde pt-4">
            {ESTADOS.map((estado) => (
              <Link
                key={estado}
                to={`${RUTA_EJECUCIONES}?estado=${estado}`}
                className="group/estado rounded-md py-0.5 hover:underline focus-visible:outline-2"
              >
                <dt className="text-xs text-texto-2">{ETIQUETA_ESTADO_EJECUCION[estado]}</dt>
                <dd className="text-base font-semibold tabular-nums text-texto">
                  {resumen.actual[estado]}
                </dd>
              </Link>
            ))}
          </dl>
        )}
      </StatTile>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Ejecuciones por día</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3">
          {/* El gráfico ocupa el alto que sobra: título arriba, gráfico en el medio, resumen abajo. */}
          <div className="relative min-h-44 flex-1">
            <EChartsLineChart
              data={serie}
              config={CONFIG_SERIE}
              isLoading={cargando}
              className="absolute inset-0 h-full w-full"
            >
              <EChartsLineChart.Grid />
              <EChartsLineChart.XAxis dataKey="fecha" tickFormatter={fechaCorta} hideDots />
              <EChartsLineChart.YAxis min={0} hideDots />
              <EChartsLineChart.Line dataKey="total" strokeWidth={2}>
                <EChartsLineChart.Dot variant="border" />
                <EChartsLineChart.ActiveDot variant="colored-border" />
              </EChartsLineChart.Line>
              <EChartsLineChart.Tooltip position="variable" />
            </EChartsLineChart>
          </div>
          {resumen && (
            <p className="text-xs text-texto-2">
              <span className="font-semibold text-exito">
                <span className="tabular-nums">{resumen.activas}</span> activas
              </span>{' '}
              ·{' '}
              <span className="font-semibold text-advertencia">
                <span className="tabular-nums">{resumen.inactivas}</span> inactivas
              </span>{' '}
              ·{' '}
              <span className="font-semibold text-error">
                <span className="tabular-nums">{resumen.con_errores}</span> con errores
              </span>
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
