import { memo, useCallback, useMemo, useRef, useState } from 'react'
import type { EChartsType } from 'echarts/core'
import { EChartsBarChart } from '@/components/ui/echarts-bar-chart'
import { EChartsLineChart } from '@/components/ui/echarts-line-chart'
import { escapeTooltipHtml, resolveTooltipPosition } from '@/components/ui/echarts-tooltip'
import { Button } from '@/components/ui/button'
import { formatearMoneda } from '@/modules/facturacion/utils'
import type { MesFinanciero } from '../services/obtener-evolucion-financiera'

export type DiaAsistencia = [string, { presentes: number; total: number }]
type Rango = { startIndex: number; endIndex: number }
type Punto = { fecha: string; porcentaje: number | null; presentes: number; total: number }
const fecha = (dia: string) => new Date(`${dia}T12:00:00`).toLocaleDateString('es-AR')
const mesLargo = (mes: string) =>
  new Date(`${mes}-01T12:00:00`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
const mesCorto = (mes: string) =>
  new Date(`${mes}-01T12:00:00`).toLocaleDateString('es-AR', { month: 'short' })
const monedaCompacta = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  notation: 'compact',
  maximumFractionDigits: 1,
})
const configFinanzas = {
  facturado: { label: 'Facturado', colors: { light: ['var(--violeta)'] } },
  cobrado: { label: 'Cobrado', colors: { light: ['var(--petroleo)'] } },
}
const configAsistencia = {
  porcentaje: { label: 'Presentismo', colors: { light: ['var(--violeta)'] } },
}
const selector =
  'min-h-10 min-w-0 rounded-md border border-borde bg-superficie px-2 text-xs text-texto focus-visible:outline-2 focus-visible:outline-violeta'

function indiceTooltip(params: unknown): number | undefined {
  const primero: unknown = Array.isArray(params) ? params[0] : params
  if (
    typeof primero === 'object' &&
    primero !== null &&
    'dataIndex' in primero &&
    typeof primero.dataIndex === 'number'
  )
    return primero.dataIndex
}
function tooltip(titulo: string, filas: string[]) {
  return `<div role="tooltip" class="rounded-lg border border-borde bg-superficie p-3 text-xs text-texto shadow-lg"><strong>${escapeTooltipHtml(titulo)}</strong>${filas.map((fila) => `<div class="mt-1 tabular-nums">${escapeTooltipHtml(fila)}</div>`).join('')}</div>`
}

// Los huecos son null, nunca cero: el eje conserva un intervalo por día calendario.
function prepararAsistencia(serie: DiaAsistencia[]): Punto[] {
  const validos = serie
    .filter(([, d]) => d.total > 0 && d.presentes >= 0 && d.presentes <= d.total)
    .sort(([a], [b]) => a.localeCompare(b))
  const primero = validos[0]?.[0]
  const ultimo = validos.at(-1)?.[0]
  if (!primero || !ultimo) return []
  const porDia = new Map(validos)
  const puntos: Punto[] = []
  for (
    let instante = Date.parse(`${primero}T00:00:00Z`);
    instante <= Date.parse(`${ultimo}T00:00:00Z`);
    instante += 86400000
  ) {
    const dia = new Date(instante).toISOString().slice(0, 10)
    const valor = porDia.get(dia)
    puntos.push({
      fecha: dia,
      porcentaje: valor ? (valor.presentes / valor.total) * 100 : null,
      presentes: valor?.presentes ?? 0,
      total: valor?.total ?? 0,
    })
  }
  return puntos
}

function useRango(cantidad: number) {
  const chart = useRef<EChartsType | null>(null)
  const [seleccion, setRango] = useState<Rango | null>(null)
  const ultimo = Math.max(0, cantidad - 1)
  const rango = seleccion
    ? {
        startIndex: Math.min(seleccion.startIndex, ultimo),
        endIndex: Math.min(seleccion.endIndex, ultimo),
      }
    : { startIndex: 0, endIndex: ultimo }
  const onReady = useCallback((instancia: EChartsType) => {
    chart.current = instancia
  }, [])
  const onChange = useCallback((valor: Rango) => setRango(valor), [])
  const cambiar = (valor: Rango) => {
    setRango(valor)
    chart.current?.dispatchAction({
      type: 'dataZoom',
      start: cantidad > 1 ? (valor.startIndex / (cantidad - 1)) * 100 : 0,
      end: cantidad > 1 ? (valor.endIndex / (cantidad - 1)) * 100 : 100,
    })
  }
  const mostrar = (indice: number) =>
    chart.current?.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: indice })
  const ocultar = () => chart.current?.dispatchAction({ type: 'hideTip' })
  return { rango, onReady, onChange, cambiar, mostrar, ocultar }
}

function ControlesRango({
  etiquetas,
  rango,
  cambiar,
}: {
  etiquetas: string[]
  rango: Rango
  cambiar: (valor: Rango) => void
}) {
  if (etiquetas.length < 2) return null
  return (
    <div className="space-y-2 border-t border-borde pt-3">
      <p className="text-xs text-texto-2">
        Intervalo visible · {etiquetas[rango.startIndex]} a {etiquetas[rango.endIndex]}
      </p>
      <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <label className="grid min-w-0 gap-1 text-xs text-texto-2">
          Desde
          <select
            aria-label="Desde"
            className={selector}
            value={rango.startIndex}
            onChange={(e) =>
              cambiar({
                startIndex: Number(e.target.value),
                endIndex: Math.max(rango.endIndex, Number(e.target.value)),
              })
            }
          >
            {etiquetas.map((texto, i) => (
              <option key={i} value={i}>
                {texto}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-xs text-texto-2">
          Hasta
          <select
            aria-label="Hasta"
            className={selector}
            value={rango.endIndex}
            onChange={(e) =>
              cambiar({
                startIndex: Math.min(rango.startIndex, Number(e.target.value)),
                endIndex: Number(e.target.value),
              })
            }
          >
            {etiquetas.map((texto, i) => (
              <option key={i} value={i}>
                {texto}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="secondary"
          size="sm"
          className="min-h-10"
          disabled={rango.startIndex === 0 && rango.endIndex === etiquetas.length - 1}
          onClick={() => cambiar({ startIndex: 0, endIndex: etiquetas.length - 1 })}
        >
          Restablecer
        </Button>
      </div>
    </div>
  )
}

const Barras = memo(function Barras({
  datos,
  onReady,
  onChange,
  expresivo,
  cargando,
}: {
  datos: { mes: string; facturado: number; cobrado: number }[]
  onReady: (chart: EChartsType) => void
  onChange: (rango: Rango) => void
  expresivo: boolean
  cargando: boolean
}) {
  const opciones = useMemo(
    () => ({
      tooltip: {
        show: !cargando,
        trigger: 'axis' as const,
        confine: true,
        backgroundColor: 'transparent',
        borderWidth: 0,
        padding: 0,
        position: resolveTooltipPosition('fixed'),
        axisPointer: { type: 'line' as const },
        formatter: (params: unknown) => {
          const i = indiceTooltip(params)
          const d = i === undefined ? undefined : datos[i]
          return d
            ? tooltip(mesLargo(d.mes), [
                `Facturado: ${formatearMoneda(d.facturado)}`,
                `Cobrado: ${formatearMoneda(d.cobrado)}`,
              ])
            : ''
        },
      },
    }),
    [datos, cargando],
  )
  return (
    <EChartsBarChart
      data={datos}
      config={configFinanzas}
      onReady={onReady}
      isLoading={cargando}
      className="h-80 w-full"
      chartOptions={opciones}
      barRadius={4}
      barGap="20%"
      barCategoryGap={8}
    >
      <EChartsBarChart.Grid />
      <EChartsBarChart.XAxis dataKey="mes" tickFormatter={mesCorto} hideDots />
      <EChartsBarChart.YAxis tickFormatter={(v) => monedaCompacta.format(Number(v))} hideDots />
      <EChartsBarChart.Bar
        dataKey="facturado"
        variant={expresivo ? 'expandable' : 'duotone'}
        enableHoverHighlight
        isClickable
      />
      <EChartsBarChart.Bar dataKey="cobrado" variant="duotone" enableHoverHighlight isClickable />
      <EChartsBarChart.Tooltip position="fixed" />
      <EChartsBarChart.Legend align="left" verticalAlign="top" isClickable />
      {datos.length > 1 && (
        <EChartsBarChart.Brush height={42} formatLabel={mesCorto} onChange={onChange} />
      )}
    </EChartsBarChart>
  )
})

const Lineas = memo(function Lineas({
  datos,
  onReady,
  onChange,
  expresivo,
  cargando,
}: {
  datos: Punto[]
  onReady: (chart: EChartsType) => void
  onChange: (rango: Rango) => void
  expresivo: boolean
  cargando: boolean
}) {
  const opciones = useMemo(
    () => ({
      tooltip: {
        show: !cargando,
        trigger: 'axis' as const,
        confine: true,
        backgroundColor: 'transparent',
        borderWidth: 0,
        padding: 0,
        position: resolveTooltipPosition('fixed'),
        axisPointer: { type: 'line' as const },
        formatter: (params: unknown) => {
          const i = indiceTooltip(params)
          const d = i === undefined ? undefined : datos[i]
          return d
            ? tooltip(
                fecha(d.fecha),
                d.porcentaje === null
                  ? ['Sin registros']
                  : [
                      `Presentismo: ${Math.round(d.porcentaje)}%`,
                      `${d.presentes} de ${d.total} registros`,
                    ],
              )
            : ''
        },
      },
    }),
    [datos, cargando],
  )
  return (
    <EChartsLineChart
      data={datos}
      config={configAsistencia}
      onReady={onReady}
      isLoading={cargando}
      className="h-72 w-full"
      chartOptions={opciones}
      enableHoverReveal={expresivo}
    >
      <EChartsLineChart.Grid />
      <EChartsLineChart.XAxis
        dataKey="fecha"
        tickFormatter={(dia) =>
          new Date(`${dia}T12:00:00`).toLocaleDateString('es-AR', {
            day: 'numeric',
            month: 'numeric',
          })
        }
        hideDots
      />
      <EChartsLineChart.YAxis
        min={0}
        max={100}
        interval={25}
        tickFormatter={(v) => `${v}%`}
        hideDots
      />
      <EChartsLineChart.Line dataKey="porcentaje" strokeWidth={2} connectNulls>
        <EChartsLineChart.Dot variant="border" />
        <EChartsLineChart.ActiveDot variant="colored-border" />
      </EChartsLineChart.Line>
      <EChartsLineChart.Tooltip position="fixed" />
      {datos.length > 1 && (
        <EChartsLineChart.Brush height={42} formatLabel={fecha} onChange={onChange} />
      )}
    </EChartsLineChart>
  )
})

function varianteExpresiva() {
  return new URLSearchParams(window.location.search).get('graficos') === 'expresivos'
}

export function GraficoFinanciero({
  meses,
  cargando = false,
}: {
  meses: MesFinanciero[]
  cargando?: boolean
}) {
  const datos = useMemo(
    () => meses.map((m) => ({ ...m, facturado: Number(m.facturado), cobrado: Number(m.cobrado) })),
    [meses],
  )
  const { rango, onReady, onChange, cambiar, mostrar, ocultar } = useRango(datos.length)
  const [activo, setActivo] = useState(0)
  if (!meses.length && !cargando)
    return <p className="text-xs text-texto-2">No hay registros para mostrar.</p>
  const ultimo = meses.at(-1)
  const seleccion = datos.slice(rango.startIndex, rango.endIndex + 1)
  const reducido = rango.startIndex > 0 || rango.endIndex < datos.length - 1
  return (
    <div
      className="space-y-3"
      onKeyDown={(e) => {
        if (e.key === 'Escape') ocultar()
      }}
    >
      <p className="text-xs text-texto-2">
        ARS · Seleccioná una serie en la leyenda para destacarla.
      </p>
      <div role="group" aria-label="Comparación mensual de facturación emitida y cobros aprobados">
        <Barras
          datos={datos}
          onReady={onReady}
          onChange={onChange}
          expresivo={varianteExpresiva()}
          cargando={cargando}
        />
      </div>
      {!cargando && (
        <>
          <ControlesRango
            etiquetas={datos.map((d) => mesLargo(d.mes))}
            rango={rango}
            cambiar={cambiar}
          />
          {reducido && (
            <p aria-live="polite" className="text-xs tabular-nums text-texto-2">
              Total del intervalo · Facturado:{' '}
              {formatearMoneda(seleccion.reduce((s, d) => s + d.facturado, 0))} · Cobrado:{' '}
              {formatearMoneda(seleccion.reduce((s, d) => s + d.cobrado, 0))}
            </p>
          )}
          <details className="text-xs text-texto-2">
            <summary className="min-h-9 cursor-pointer py-2">Consultar valores por mes</summary>
            <label className="grid gap-2">
              Mes a consultar
              <select
                className={selector}
                value={activo}
                onChange={(e) => {
                  const i = Number(e.target.value)
                  setActivo(i)
                  mostrar(i)
                }}
              >
                {datos.map((d, i) => (
                  <option key={d.mes} value={i}>
                    {mesLargo(d.mes)}
                  </option>
                ))}
              </select>
            </label>
            <p aria-live="polite" className="py-2">
              Facturado: {formatearMoneda(datos[activo]?.facturado ?? 0)} · Cobrado:{' '}
              {formatearMoneda(datos[activo]?.cobrado ?? 0)}
            </p>
          </details>
          {ultimo && (
            <div
              aria-label="Resumen financiero del último mes"
              className="border-t border-borde pt-3"
            >
              <p className="mb-1 text-xs text-texto-2">Último mes · {mesLargo(ultimo.mes)}</p>
              <dl className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-xs text-texto-2">Facturado</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatearMoneda(ultimo.facturado)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-texto-2">Cobrado</dt>
                  <dd className="font-semibold tabular-nums">{formatearMoneda(ultimo.cobrado)}</dd>
                </div>
              </dl>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function GraficoAsistencia({
  serie,
  cargando = false,
}: {
  serie: DiaAsistencia[]
  cargando?: boolean
}) {
  const datos = useMemo(() => prepararAsistencia(serie), [serie])
  const { rango, onReady, onChange, cambiar, mostrar, ocultar } = useRango(datos.length)
  const [activo, setActivo] = useState(0)
  if (!datos.length && !cargando)
    return <p className="text-xs text-texto-2">No hay registros para mostrar.</p>
  const seleccion = datos.slice(rango.startIndex, rango.endIndex + 1)
  const total = seleccion.reduce((s, d) => s + d.total, 0)
  const presentes = seleccion.reduce((s, d) => s + d.presentes, 0)
  const punto = datos[activo]
  return (
    <div
      className="space-y-3"
      onKeyDown={(e) => {
        if (e.key === 'Escape') ocultar()
      }}
    >
      {!cargando && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-64 text-xs text-texto-2">
            Presentes y tardanzas sobre asistencias registradas en el intervalo visible.
          </p>
          <div aria-label="Presentismo registrado" aria-live="polite" className="text-right">
            <strong className="block text-2xl font-semibold tabular-nums text-violeta">
              {total ? `${Math.round((presentes / total) * 100)}%` : 'Sin registros'}
            </strong>
            <span className="text-xs text-texto-2">
              {presentes} de {total} registros
            </span>
          </div>
        </div>
      )}
      <div role="group" aria-label="Presentismo diario de los últimos 30 días">
        <span className="sr-only">Escala de presentismo: 0 a 100 %.</span>
        <Lineas
          datos={datos}
          onReady={onReady}
          onChange={onChange}
          expresivo={varianteExpresiva()}
          cargando={cargando}
        />
      </div>
      {!cargando && (
        <>
          <ControlesRango
            etiquetas={datos.map((d) => fecha(d.fecha))}
            rango={rango}
            cambiar={cambiar}
          />
          <details className="text-xs text-texto-2">
            <summary className="min-h-9 cursor-pointer py-2">Consultar valores por fecha</summary>
            <label className="grid gap-2">
              Fecha a consultar
              <select
                className={selector}
                value={activo}
                onChange={(e) => {
                  const i = Number(e.target.value)
                  setActivo(i)
                  mostrar(i)
                }}
              >
                {datos.map((d, i) => (
                  <option key={d.fecha} value={i}>
                    {fecha(d.fecha)}
                  </option>
                ))}
              </select>
            </label>
            <p aria-live="polite" className="py-2">
              {punto?.porcentaje == null
                ? 'Sin registros'
                : `Presentismo: ${Math.round(punto.porcentaje)}% · ${punto.presentes} de ${punto.total} registros`}
            </p>
          </details>
          <p className="text-xs text-texto-2">Los días sin registros no se consideran ausencias.</p>
        </>
      )}
    </div>
  )
}
