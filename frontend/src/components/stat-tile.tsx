import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatTileProps {
  label: string
  value: string | number
  icon: LucideIcon
  note?: string
  variant?: 'default' | 'dark'
  iconClassName?: string
  className?: string
}

// Card de indicador (§9 DESIGN.md): etiqueta a la izquierda, tile de ícono a la derecha,
// valor grande y tabular debajo, nota opcional. `variant="dark"` es el ancla visual de la
// grilla, sobre `banda-oscura`, con el motivo geométrico del isotipo (§13) recortado por el
// radio de la card.
export function StatTile({
  label,
  value,
  icon: Icon,
  note,
  variant = 'default',
  iconClassName,
  className,
}: StatTileProps) {
  const esOscuro = variant === 'dark'

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-card-sm p-5 shadow-card',
        esOscuro ? 'bg-banda-oscura' : 'bg-superficie',
        className,
      )}
    >
      {esOscuro && (
        <svg
          viewBox="0 0 130 130"
          aria-hidden="true"
          className="pointer-events-none absolute -right-5 -bottom-5 size-32 opacity-[0.09]"
        >
          <g fill="none" stroke="#fff" strokeWidth="1.5">
            <path d="M65 10 112 36 112 84 65 110 18 84 18 36Z" />
            <path d="M65 36 92 51 92 79 65 94 38 79 38 51Z" />
          </g>
        </svg>
      )}
      <div className="relative flex items-start justify-between gap-2.5">
        <p className={cn('text-xs font-semibold', esOscuro ? 'text-texto-2-sobre-oscuro' : 'text-texto-2')}>
          {label}
        </p>
        <div
          className={cn(
            'flex size-[30px] shrink-0 items-center justify-center rounded-[9px]',
            esOscuro ? 'bg-white/14 text-texto-sobre-oscuro' : 'bg-violeta-suave text-violeta',
            iconClassName,
          )}
        >
          <Icon className="size-4" />
        </div>
      </div>
      <p
        className={cn(
          'relative mt-2.5 text-2xl font-semibold tabular-nums',
          esOscuro ? 'text-texto-sobre-oscuro' : 'text-texto',
        )}
      >
        {value}
      </p>
      {note && (
        <p
          className={cn(
            'relative mt-1.5 text-xs',
            esOscuro ? 'text-texto-2-sobre-oscuro/85' : 'text-texto-3',
          )}
        >
          {note}
        </p>
      )}
    </div>
  )
}
