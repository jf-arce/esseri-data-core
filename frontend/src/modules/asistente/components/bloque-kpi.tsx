import {
  CalendarIcon,
  ChartNoAxesColumnIcon,
  ClipboardListIcon,
  GraduationCapIcon,
  HistoryIcon,
  InfoIcon,
  ListChecksIcon,
  MinusIcon,
  ShoppingCartIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  TriangleAlertIcon,
  UserXIcon,
  WalletIcon,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BloqueKpi } from '../types'
import { formatearKpi, iconoDeKpi, tonoDeKpi, type IconoKpi, type TonoKpi } from '../utils/kpi'
import { formatearVariacion } from '../utils/tablas'

const ICONOS: Record<IconoKpi, LucideIcon> = {
  dinero: WalletIcon,
  deuda: TriangleAlertIcon,
  ausentes: UserXIcon,
  inscripciones: ClipboardListIcon,
  alumnos: GraduationCapIcon,
  tareas: ListChecksIcon,
  compras: ShoppingCartIcon,
  general: ChartNoAxesColumnIcon,
}

// Cada tono tiñe el borde de la tarjeta, el ícono, la cifra y el badge de la variación. El fondo
// es plano (sin degradé) para que el texto conserve el contraste en tema claro.
const TONOS: Record<TonoKpi, Record<'tarjeta' | 'icono' | 'cifra' | 'badge', string>> = {
  bueno: {
    tarjeta: 'border-exito/40',
    icono: 'bg-exito-suave text-exito',
    cifra: 'text-exito',
    badge: 'bg-exito text-superficie',
  },
  malo: {
    tarjeta: 'border-error/40',
    icono: 'bg-error-suave text-error',
    cifra: 'text-error',
    badge: 'bg-error text-superficie',
  },
  neutro: {
    tarjeta: 'border-borde',
    icono: 'bg-violeta-suave text-violeta',
    cifra: 'text-texto',
    badge: 'bg-info text-superficie',
  },
}

/** Indicador con su período y su fuente: sin ellos una cifra no se puede auditar. */
export function BloqueKpiVista({ bloque }: { bloque: BloqueKpi }) {
  const variacion = bloque.variacion
  const compara = bloque.periodo_comparado !== undefined
  const hayBase = variacion !== null && variacion !== undefined
  // Contra 0 no hay porcentaje, pero la cifra anterior sí se puede mostrar.
  const anterior = bloque.valor_anterior

  const tono = TONOS[tonoDeKpi(bloque)]
  const Icono = ICONOS[iconoDeKpi(bloque)]
  const IconoVariacion =
    variacion === 0
      ? MinusIcon
      : variacion !== undefined && variacion !== null && variacion < 0
        ? TrendingDownIcon
        : TrendingUpIcon
  return (
    <div className={cn('flex flex-col gap-3 rounded-2xl border bg-superficie p-3.5', tono.tarjeta)}>
      <div className="flex items-center gap-2">
        <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', tono.icono)}>
          <Icono aria-hidden className="size-4" />
        </span>
        <p className="text-sm font-medium text-texto">{bloque.titulo}</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <p className={cn('text-3xl leading-none font-semibold tabular-nums', tono.cifra)}>
          {formatearKpi(bloque)}
        </p>
        {compara &&
          (hayBase ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
                tono.badge,
              )}
            >
              <IconoVariacion aria-hidden className="size-3.5" />
              {formatearVariacion(variacion)}
              <span className="sr-only">{variacion >= 0 ? ' más' : ' menos'}</span>
            </span>
          ) : anterior !== undefined ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-info-suave px-2 py-0.5 text-xs font-medium text-info tabular-nums">
              <HistoryIcon aria-hidden className="size-3.5" />
              Antes: {formatearKpi({ ...bloque, valor: anterior })}
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-advertencia-suave px-2 py-0.5 text-xs font-medium text-advertencia"
              title={`Período comparado: ${bloque.periodo_comparado}`}
            >
              <InfoIcon aria-hidden className="size-3.5" />
              Sin base de comparación
            </span>
          ))}
      </div>
      {compara && (hayBase || anterior !== undefined) && (
        <p className="text-xs text-texto-2">vs. {bloque.periodo_comparado}</p>
      )}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-texto-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-fila-hover px-2 py-0.5">
          <CalendarIcon aria-hidden className="size-3" />
          {bloque.periodo}
        </span>
        <span>{bloque.fuente}</span>
      </div>
    </div>
  )
}
