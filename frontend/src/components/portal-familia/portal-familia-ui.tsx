import type { ReactNode } from 'react'
import { CircleAlertIcon, type LucideIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export type PortalFamiliaTone = 'lavanda' | 'ambar' | 'azul' | 'verde' | 'rojo'

export const TONOS: Record<PortalFamiliaTone, { card: string; tile: string }> = {
  lavanda: { card: 'bg-pf-lavanda-card', tile: 'bg-pf-lavanda-bg text-pf-lavanda-fg' },
  ambar: { card: 'bg-pf-ambar-card', tile: 'bg-pf-ambar-bg text-pf-ambar-fg' },
  azul: { card: 'bg-pf-azul-card', tile: 'bg-pf-azul-bg text-pf-azul-fg' },
  verde: { card: 'bg-pf-verde-card', tile: 'bg-pf-verde-bg text-pf-verde-fg' },
  rojo: { card: 'bg-pf-rojo-card', tile: 'bg-pf-rojo-bg text-pf-rojo-fg' },
}

export const PORTAL_PRIMARY_BUTTON_CLASS =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-pf-accent px-5 text-pf-cuerpo font-semibold text-superficie transition-colors hover:bg-pf-accent-hover'

export const PORTAL_SECONDARY_BUTTON_CLASS = 'rounded-full'

type PortalStatTileProps = {
  label: string
  value: ReactNode
  detalle?: ReactNode
  icon: LucideIcon
  tone?: PortalFamiliaTone
  cargando?: boolean
  ariaLabel?: string
  className?: string
  detalleClassName?: string
}

/** Tile pastel de indicador, con la misma anatomía en home, facturación y asistencias. */
export function PortalStatTile({
  label,
  value,
  detalle,
  icon: Icon,
  tone = 'lavanda',
  cargando = false,
  ariaLabel,
  className,
  detalleClassName,
}: PortalStatTileProps) {
  return (
    <article
      role={ariaLabel ? 'group' : undefined}
      aria-label={ariaLabel}
      className={cn(
        'flex items-center gap-4 rounded-pf-tile p-5',
        TONOS[tone].card,
        className,
      )}
    >
      <span
        className={cn(
          'flex size-14 shrink-0 items-center justify-center rounded-pf-icono',
          TONOS[tone].tile,
        )}
      >
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <div className="min-w-0">
        {cargando ? (
          <Skeleton className="h-7 w-14" />
        ) : (
          <p className="font-heading text-pf-cifra leading-none font-bold tabular-nums text-texto">
            {value}
          </p>
        )}
        <p className="mt-2 text-pf-cuerpo leading-tight font-semibold text-texto">{label}</p>
        {detalle && (
          <p className={cn('text-sm leading-tight text-texto-2', detalleClassName)}>
            {detalle}
          </p>
        )}
      </div>
    </article>
  )
}

type PortalCardProps = {
  titulo?: ReactNode
  descripcion?: ReactNode
  icono?: LucideIcon
  tone?: PortalFamiliaTone
  accion?: ReactNode
  children: ReactNode
  className?: string
  headerClassName?: string
  contentClassName?: string
  tituloClassName?: string
  nivelEncabezado?: 2 | 3
}

/** Card blanca suave del portal familiar, con header opcional e ícono pastel. */
export function PortalCard({
  titulo,
  descripcion,
  icono: Icono,
  tone = 'lavanda',
  accion,
  children,
  className,
  headerClassName,
  contentClassName,
  tituloClassName,
  nivelEncabezado = 2,
}: PortalCardProps) {
  return (
    <Card
      className={cn(
        'gap-0 rounded-pf-card border-0 bg-superficie py-0 shadow-pf-card',
        className,
      )}
    >
      {(titulo || accion) && (
        <CardHeader className={cn('px-5 pt-5 pb-0', headerClassName)}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              {Icono && (
                <span
                  className={cn(
                    'flex size-12 shrink-0 items-center justify-center rounded-pf-icono',
                    TONOS[tone].tile,
                  )}
                >
                  <Icono aria-hidden="true" className="size-6" />
                </span>
              )}
              <div className="min-w-0">
                {titulo && (
                  <CardTitle
                    role="heading"
                    aria-level={nivelEncabezado}
                    className={cn('text-pf-encabezado font-semibold text-texto', tituloClassName)}
                  >
                    {titulo}
                  </CardTitle>
                )}
                {descripcion && (
                  <CardDescription className="text-sm leading-snug text-texto-2">
                    {descripcion}
                  </CardDescription>
                )}
              </div>
            </div>
            {accion}
          </div>
        </CardHeader>
      )}
      <CardContent className={cn('px-5 pt-4 pb-5', contentClassName)}>{children}</CardContent>
    </Card>
  )
}

type PortalAlertBannerProps = {
  titulo: ReactNode
  descripcion: ReactNode
  accion?: ReactNode
  className?: string
}

/** Banner ámbar de alerta, con acción primaria violeta. */
export function PortalAlertBanner({
  titulo,
  descripcion,
  accion,
  className,
}: PortalAlertBannerProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-pf-tile bg-pf-ambar-card p-5 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-advertencia text-advertencia">
          <CircleAlertIcon aria-hidden="true" className="size-6" />
        </span>
        <div>
          <p className="text-pf-encabezado font-semibold text-texto">{titulo}</p>
          <p className="mt-1 text-pf-cuerpo text-texto-2">{descripcion}</p>
        </div>
      </div>
      {accion}
    </div>
  )
}
