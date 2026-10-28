import type { ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatearMoneda } from '@/modules/facturacion/utils'
import type { MesFinanciero } from '../services/obtener-evolucion-financiera'

export type DiaAsistencia = [string, { presentes: number; total: number }]

function TooltipGrafico({ texto, children }: { texto: ReactNode; children: ReactNode }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
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

function Rejilla() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex flex-col justify-between"
    >
      {[0, 1, 2, 3, 4].map((n) => (
        <div key={n} className="w-full border-t border-dashed border-borde" />
      ))}
    </div>
  )
}

export function GraficoFinanciero({ meses }: { meses: MesFinanciero[] }) {
  const maximo = Math.max(
    1,
    ...meses.flatMap((mes) => [Number(mes.facturado), Number(mes.cobrado)]),
  )
  const magnitud = 10 ** Math.floor(Math.log10(maximo))
  const tope = Math.ceil(maximo / magnitud) * magnitud
  const ultimo = meses.at(-1)
  return (
    <div className="space-y-4">
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
          <Rejilla />
          {meses.map((mes) => (
            <TooltipGrafico
              key={mes.mes}
              texto={
                <span className="space-y-1">
                  <strong className="block">{mesLargo(mes.mes)}</strong>
                  <span className="block">Facturado: {formatearMoneda(mes.facturado)}</span>
                  <span className="block">Cobrado: {formatearMoneda(mes.cobrado)}</span>
                </span>
              }
            >
              <button
                type="button"
                aria-label={`Ver valores de ${mes.mes}`}
                className="relative flex h-full min-w-0 flex-1 cursor-help items-end justify-center gap-1 rounded-sm hover:bg-fila-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violeta"
              >
                <span
                  className="block w-full max-w-4 rounded-t-sm bg-violeta"
                  style={{ height: `${(Number(mes.facturado) / tope) * 100}%` }}
                />
                <span
                  className="block w-full max-w-4 rounded-t-sm bg-petroleo"
                  style={{ height: `${(Number(mes.cobrado) / tope) * 100}%` }}
                />
              </button>
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
  const total = serie.reduce((suma, [, dia]) => suma + dia.total, 0)
  const presentes = serie.reduce((suma, [, dia]) => suma + dia.presentes, 0)
  const inicio = Date.parse(`${serie[0][0]}T00:00:00Z`)
  const fin = Date.parse(`${serie.at(-1)![0]}T00:00:00Z`)
  const x = (dia: string) =>
    fin === inicio ? 300 : 8 + ((Date.parse(`${dia}T00:00:00Z`) - inicio) / (fin - inicio)) * 584
  return (
    <div className="space-y-4">
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
          <Rejilla />
          <svg
            viewBox="0 0 600 100"
            preserveAspectRatio="none"
            role="group"
            aria-label="Presentismo diario de los últimos 30 días"
            className="relative h-full w-full overflow-visible text-violeta"
          >
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              points={serie
                .map(([dia, valor]) => `${x(dia)},${100 - (valor.presentes / valor.total) * 100}`)
                .join(' ')}
            />
            {serie.map(([dia, valor]) => (
              <TooltipGrafico
                key={dia}
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
                <circle
                  tabIndex={0}
                  role="button"
                  aria-label={`Ver asistencia del ${fecha(dia)}`}
                  className="cursor-help focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violeta"
                  cx={x(dia)}
                  cy={100 - (valor.presentes / valor.total) * 100}
                  r="3.5"
                  fill="currentColor"
                />
              </TooltipGrafico>
            ))}
          </svg>
        </div>
        <span className="sr-only">Fecha</span>
        <div className="col-start-2 flex justify-between gap-2 text-xs tabular-nums text-texto-2">
          <span>{fecha(serie[0][0])}</span>
          {serie.length > 2 && (
            <span className="hidden sm:inline">
              {fecha(serie[Math.floor((serie.length - 1) / 2)][0])}
            </span>
          )}
          {serie.length > 1 && <span>{fecha(serie.at(-1)![0])}</span>}
        </div>
      </div>
      <p className="text-xs text-texto-2">Los días sin registros no se consideran ausencias.</p>
    </div>
  )
}
