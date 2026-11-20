import type { ReactNode } from 'react'
import { CircleAlertIcon, type LucideIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { TONOS, type PortalFamiliaTone } from './portal-familia-tonos'

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
      className={cn('flex items-center gap-3 rounded-pf-tile p-4', TONOS[tone].card, className)}
    >
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-pf-item',
          TONOS[tone].tile,
        )}
      >
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <div className="min-w-0">
        {cargando ? (
          <Skeleton className="h-7 w-14" />
        ) : (
          <p className="font-heading text-pf-cifra leading-none font-bold tabular-nums text-texto">
            {value}
          </p>
        )}
        <p className="mt-1.5 text-pf-cuerpo leading-tight font-semibold text-texto">{label}</p>
        {detalle && (
          <p className={cn('text-sm leading-tight text-texto-2', detalleClassName)}>{detalle}</p>
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
  tituloId?: string
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
  tituloId,
  nivelEncabezado = 2,
}: PortalCardProps) {
  return (
    <Card
      className={cn('gap-0 rounded-pf-card border-0 bg-superficie py-0 shadow-pf-card', className)}
    >
      {(titulo || accion) && (
        <CardHeader className={cn('px-5 pt-4 pb-0', headerClassName)}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              {Icono && (
                <span
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-pf-item',
                    TONOS[tone].tile,
                  )}
                >
                  <Icono aria-hidden="true" className="size-5" />
                </span>
              )}
              <div className="min-w-0">
                {titulo && (
                  <CardTitle
                    id={tituloId}
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
      <CardContent className={cn('px-5 pt-4 pb-4', contentClassName)}>{children}</CardContent>
    </Card>
  )
}

type PortalSkeletonRegionProps = {
  etiqueta: string
  children: ReactNode
  className?: string
}

/** Contenedor accesible de cualquier skeleton del portal (`role="status"` + `aria-busy`). */
export function PortalSkeletonRegion({ etiqueta, children, className }: PortalSkeletonRegionProps) {
  return (
    <div role="status" aria-busy="true" aria-label={etiqueta} className={className}>
      {children}
      <span className="sr-only">{etiqueta}</span>
    </div>
  )
}

type PortalCardSkeletonProps = {
  conEncabezado?: boolean
  conIcono?: boolean
  children?: ReactNode
  className?: string
  headerClassName?: string
  contentClassName?: string
}

/** Silueta de `PortalCard`: mismo radio, sombra y header (ícono + título + descripción). */
export function PortalCardSkeleton({
  conEncabezado = true,
  conIcono = true,
  children,
  className,
  headerClassName,
  contentClassName,
}: PortalCardSkeletonProps) {
  return (
    <Card
      aria-hidden="true"
      className={cn('gap-0 rounded-pf-card border-0 bg-superficie py-0 shadow-pf-card', className)}
    >
      {conEncabezado && (
        <CardHeader className={cn('px-5 pt-4 pb-0', headerClassName)}>
          <div className="flex items-start gap-3">
            {conIcono && <Skeleton className="size-10 shrink-0 rounded-pf-item" />}
            <div className="min-w-0 flex-1 space-y-2 pt-0.5">
              <Skeleton className="h-5 w-40 max-w-full" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>
          </div>
        </CardHeader>
      )}
      {children && (
        <CardContent className={cn('px-5 pt-4 pb-4', contentClassName)}>{children}</CardContent>
      )}
    </Card>
  )
}

type SkeletonFilaProps = {
  className?: string
  avatarClassName?: string
  /** Cantidad de bloques de acción a la derecha. */
  acciones?: number
}

/** Fila genérica: avatar o ícono, dos líneas de texto y acción opcional a la derecha. */
export function SkeletonFila({ className, avatarClassName, acciones = 0 }: SkeletonFilaProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Skeleton className={cn('size-10 shrink-0 rounded-full', avatarClassName)} />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-40 max-w-full" />
        <Skeleton className="h-3.5 w-24 max-w-full" />
      </div>
      {Array.from({ length: acciones }, (_, indice) => (
        <Skeleton key={indice} className="hidden h-5 w-16 sm:block" />
      ))}
    </div>
  )
}

/** Silueta de `PortalStatTile` sin ícono propio, para grillas de indicadores. */
export function SkeletonTile({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 rounded-pf-tile bg-pf-item p-4', className)}>
      <Skeleton className="size-10 shrink-0 rounded-pf-item" />
      <div className="min-w-0 space-y-2">
        <Skeleton className="h-7 w-14" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  )
}

type PortalAlertBannerProps = {
  titulo: ReactNode
  descripcion: ReactNode
  accion?: ReactNode
  className?: string
}

/** Banner de alerta en lila, con acción primaria violeta. */
export function PortalAlertBanner({
  titulo,
  descripcion,
  accion,
  className,
}: PortalAlertBannerProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-pf-tile bg-pf-lila p-4 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-pf-accent text-pf-accent">
          <CircleAlertIcon aria-hidden="true" className="size-5" />
        </span>
        <div>
          <p className="text-pf-encabezado font-semibold text-texto">{titulo}</p>
          <p className="mt-0.5 text-pf-cuerpo text-texto">{descripcion}</p>
        </div>
      </div>
      {accion}
    </div>
  )
}
