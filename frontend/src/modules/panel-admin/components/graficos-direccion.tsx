import { useState, type ReactNode } from 'react'
import { EvilBarChart } from '@/components/ui/recharts-bar-chart'
import { EvilLineChart } from '@/components/ui/recharts-line-chart'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatearMoneda } from '@/modules/facturacion/utils'
import type { MesFinanciero } from '../services/obtener-evolucion-financiera'

export type DiaAsistencia = [string, { presentes: number; total: number }]

function TooltipGrafico({
  texto,
  children,
  onOpenChange,
}: {
  texto: ReactNode
  children: ReactNode
  onOpenChange?: (open: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const cambiarAbierto = (abierto: boolean) => {
    setOpen(abierto)
    onOpenChange?.(abierto)
  }
  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={cambiarAbierto}>
        <TooltipTrigger
          asChild
          onClick={(event) => {
            // Radix cierra los tooltips al hacer clic; el gráfico también debe abrirse al tocar.
            event.preventDefault()
            cambiarAbierto(true)
          }}
        >
          {children}
        </TooltipTrigger>
        <TooltipContent sideOffset={8}>{texto}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

const fecha = (dia: string) => new Date(`${dia}T12:00:00`).toLocaleDateString('es-AR')
const mesLargo = (mes: string) =>
  new Date(`${mes}-01T12:00:00`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
const monedaCompacta = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function GraficoFinanciero({ meses }: { meses: MesFinanciero[] }) {
  const [mesActivo, setMesActivo] = useState<string | null>(null)
  if (!meses.length) return <p className="text-xs text-texto-2">No hay registros para mostrar.</p>
  const datos = meses.map((mes) => ({
    ...mes,
    facturado: Number(mes.facturado),
    cobrado: Number(mes.cobrado),
  }))
  const maximo = Math.max(
    1,
    ...meses.flatMap((mes) => [Number(mes.facturado), Number(mes.cobrado)]),
  )
  const magnitud = 10 ** Math.floor(Math.log10(maximo))
  const tope = Math.ceil(maximo / magnitud) * magnitud
  const ultimo = meses.at(-1)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-texto-2">
        <div className="flex gap-4">
          <span className="inline-flex items-center gap-2">
            <span className="size-2 rounded-full bg-violeta" />
            Facturado
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="size-2 rounded-full bg-petroleo" />
            Cobrado
          </span>
        </div>
        <span>ARS · {meses[0]?.mes.slice(0, 4)}</span>
      </div>
      <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-2 gap-y-2 pt-1">
        <div
          aria-label="Escala financiera en pesos argentinos"
          className="relative h-40 text-right text-xs tabular-nums text-texto-2"
        >
          {[1, 0.75, 0.5, 0.25, 0].map((fraccion) => (
            <span
              key={fraccion}
              className="absolute right-0 -translate-y-1/2 whitespace-nowrap"
              style={{ top: `${(1 - fraccion) * 100}%` }}
            >
              {monedaCompacta.format(tope * fraccion)}
            </span>
          ))}
        </div>
        <div
          role="group"
          aria-label="Comparación mensual de facturación emitida y cobros aprobados"
          className="relative flex h-40 min-w-0 items-end gap-1"
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <EvilBarChart
              data={datos}
              margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
              barCategoryGap="20%"
              barGap={4}
            >
              <EvilBarChart.Grid vertical={false} stroke="var(--borde)" strokeDasharray="3 3" />
              <EvilBarChart.XAxis hide dataKey="mes" />
              <EvilBarChart.YAxis
                hide
                domain={[0, tope]}
                ticks={[0, tope / 4, tope / 2, tope * 0.75, tope]}
              />
              <EvilBarChart.Bar
                dataKey="facturado"
                fill="var(--violeta)"
                radius={[2, 2, 0, 0]}
                maxBarSize={16}
              >
                {meses.map((mes) => (
                  <EvilBarChart.Cell
                    key={mes.mes}
                    fillOpacity={mesActivo && mesActivo !== mes.mes ? 0.25 : 1}
                  />
                ))}
              </EvilBarChart.Bar>
              <EvilBarChart.Bar
                dataKey="cobrado"
                fill="var(--petroleo)"
                radius={[2, 2, 0, 0]}
                maxBarSize={16}
              >
                {meses.map((mes) => (
                  <EvilBarChart.Cell
                    key={mes.mes}
                    fillOpacity={mesActivo && mesActivo !== mes.mes ? 0.25 : 1}
                  />
                ))}
              </EvilBarChart.Bar>
            </EvilBarChart>
          </div>
          {meses.map((mes) => (
            <TooltipGrafico
              key={mes.mes}
              onOpenChange={(open) =>
                setMesActivo((actual) => (open ? mes.mes : actual === mes.mes ? null : actual))
              }
              texto={
                <span className="flex flex-col gap-1">
                  <strong className="block">{mesLargo(mes.mes)}</strong>
                  <span className="block">Facturado: {formatearMoneda(mes.facturado)}</span>
                  <span className="block">Cobrado: {formatearMoneda(mes.cobrado)}</span>
                </span>
              }
            >
              <button
                type="button"
                aria-label={`Ver valores de ${mes.mes}`}
                className="relative flex h-full min-w-0 flex-1 cursor-help items-end justify-center gap-1 rounded-sm hover:bg-fila-hover/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violeta"
              />
            </TooltipGrafico>
          ))}
        </div>
        <span className="sr-only">Mes</span>
        <div className="col-start-2 flex min-w-0 gap-1 text-xs text-texto-2">
          {meses.map((mes, i) => (
            <span
              key={mes.mes}
              className={`min-w-0 flex-1 text-center ${meses.length > 6 && i !== 0 && i !== meses.length - 1 && (i % 2 || i >= meses.length - 2) ? 'invisible sm:visible' : ''}`}
            >
              {new Date(`${mes.mes}-01T12:00:00`).toLocaleDateString('es-AR', { month: 'short' })}
            </span>
          ))}
        </div>
      </div>
      {ultimo && (
        <div aria-label="Resumen financiero del último mes" className="border-t border-borde pt-3">
          <p className="mb-1 text-xs text-texto-2">Último mes · {mesLargo(ultimo.mes)}</p>
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs text-texto-2">Facturado</dt>
              <dd className="break-words font-semibold leading-snug tabular-nums">
                {formatearMoneda(ultimo.facturado)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-texto-2">Cobrado</dt>
              <dd className="break-words font-semibold leading-snug tabular-nums">
                {formatearMoneda(ultimo.cobrado)}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  )
}

export function GraficoAsistencia({ serie }: { serie: DiaAsistencia[] }) {
  const [diaActivo, setDiaActivo] = useState<string | null>(null)
  const dias = serie.filter(([, dia]) => dia.total > 0)
  const total = dias.reduce((suma, [, dia]) => suma + dia.total, 0)
  const presentes = dias.reduce((suma, [, dia]) => suma + dia.presentes, 0)
  const primero = dias[0]
  const ultimo = dias.at(-1)
  if (!primero || !ultimo)
    return <p className="text-xs text-texto-2">No hay registros para mostrar.</p>
  const inicio = Date.parse(`${primero[0]}T00:00:00Z`)
  const fin = Date.parse(`${ultimo[0]}T00:00:00Z`)
  const datos = dias.map(([dia, valor]) => ({
    instante: Date.parse(`${dia}T00:00:00Z`),
    porcentaje: (valor.presentes / valor.total) * 100,
  }))
  const x = (dia: string) =>
    fin === inicio ? 50 : ((Date.parse(`${dia}T00:00:00Z`) - inicio) / (fin - inicio)) * 100
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-64 text-xs text-texto-2">
          Presentes y tardanzas sobre asistencias registradas.
        </p>
        <div aria-label="Presentismo registrado" className="text-right">
          <strong className="block text-2xl font-semibold leading-snug tabular-nums text-violeta">
            {Math.round((presentes / total) * 100)}%
          </strong>
          <span className="text-xs tabular-nums text-texto-2">
            {presentes} de {total} registros
          </span>
        </div>
      </div>
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-3 gap-y-2 pt-1">
        <div
          aria-label="Escala de presentismo"
          className="relative h-36 text-right text-xs tabular-nums text-texto-2"
        >
          {[100, 75, 50, 25, 0].map((valor) => (
            <span
              key={valor}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: `${100 - valor}%` }}
            >
              {valor}%
            </span>
          ))}
        </div>
        <div className="relative h-36 min-w-0">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <EvilLineChart data={datos} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <EvilLineChart.Grid vertical={false} stroke="var(--borde)" strokeDasharray="3 3" />
              <EvilLineChart.XAxis
                hide
                dataKey="instante"
                type="number"
                scale="time"
                domain={inicio === fin ? [inicio - 86400000, fin + 86400000] : [inicio, fin]}
              />
              <EvilLineChart.YAxis hide domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} />
              {diaActivo && (
                <EvilLineChart.ReferenceLine
                  x={Date.parse(`${diaActivo}T00:00:00Z`)}
                  stroke="var(--violeta)"
                  strokeOpacity={0.35}
                  strokeDasharray="3 3"
                />
              )}
              <EvilLineChart.Line
                dataKey="porcentaje"
                type="linear"
                stroke="var(--violeta)"
                strokeWidth={1.5}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            </EvilLineChart>
          </div>
          <div
            role="group"
            aria-label="Presentismo diario de los últimos 30 días"
            className="absolute inset-0"
          >
            {dias.map(([dia, valor]) => (
              <TooltipGrafico
                key={dia}
                onOpenChange={(open) =>
                  setDiaActivo((actual) => (open ? dia : actual === dia ? null : actual))
                }
                texto={
                  <span>
                    <strong className="block">{fecha(dia)}</strong>
                    <span className="block">
                      Presentismo: {Math.round((valor.presentes / valor.total) * 100)}%
                    </span>
                    <span className="block">
                      {valor.presentes} de {valor.total} registros
                    </span>
                  </span>
                }
              >
                <button
                  type="button"
                  aria-label={`Ver asistencia del ${fecha(dia)}`}
                  className="group absolute flex size-10 -translate-x-1/2 -translate-y-1/2 cursor-help items-center justify-center rounded-full focus-visible:shadow-none focus-visible:outline-none"
                  style={{
                    left: `${x(dia)}%`,
                    top: `${100 - (valor.presentes / valor.total) * 100}%`,
                  }}
                >
                  <span className="size-1.5 rounded-full bg-violeta ring-superficie group-hover:scale-150 group-focus:scale-150 group-hover:ring-4 group-focus:ring-4 motion-safe:transition-transform motion-safe:duration-150 group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-violeta group-data-[state=instant-open]:ring-4 group-data-[state=instant-open]:scale-150" />
                </button>
              </TooltipGrafico>
            ))}
          </div>
        </div>
        <span className="sr-only">Fecha</span>
        <div className="col-start-2 flex justify-between gap-2 text-xs tabular-nums text-texto-2">
          <span>{fecha(primero[0])}</span>
          {dias.length > 2 && (
            <span className="hidden sm:inline">
              {fecha(new Date((inicio + fin) / 2).toISOString().slice(0, 10))}
            </span>
          )}
          {dias.length > 1 && <span>{fecha(ultimo[0])}</span>}
        </div>
      </div>
      <p className="text-xs text-texto-2">Los días sin registros no se consideran ausencias.</p>
    </div>
  )
}
