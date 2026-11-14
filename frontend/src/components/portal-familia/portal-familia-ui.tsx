import type { ReactNode } from 'react'
import { CircleAlertIcon, type LucideIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export type PortalFamiliaTone = 'lavanda' | 'ambar' | 'azul' | 'verde' | 'rojo'

const TONOS: Record<PortalFamiliaTone, { card: string; tile: string }> = {
  lavanda: { card: 'bg-[#F5F1FB]', tile: 'bg-[#E3CEF6] text-[#832ED2]' },
  ambar: { card: 'bg-[#FBF2E7]', tile: 'bg-[#FCE4CA] text-[#DF8A2F]' },
  azul: { card: 'bg-[#ECF0FD]', tile: 'bg-[#DCE9FC] text-[#4F86D9]' },
  verde: { card: 'bg-[#EFF7EE]', tile: 'bg-[#DCEEDC] text-[#4F8F46]' },
  rojo: { card: 'bg-[#FDF0ED]', tile: 'bg-[#F8DAD5] text-[#B42318]' },
}

export const PORTAL_PRIMARY_BUTTON_CLASS =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#7A31A3] px-5 text-[15px] font-semibold text-white shadow-[0_8px_18px_rgba(80,20,120,0.28)] transition-colors hover:bg-[#6A2494]'

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
        'flex items-center gap-4 rounded-[22px] p-5 shadow-[0_10px_26px_rgba(24,16,40,0.08)]',
        TONOS[tone].card,
        className,
      )}
    >
      <span
        className={cn(
          'flex size-14 shrink-0 items-center justify-center rounded-[14px]',
          TONOS[tone].tile,
        )}
      >
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <div className="min-w-0">
        {cargando ? (
          <Skeleton className="h-7 w-14 bg-white/60" />
        ) : (
          <p className="font-heading text-[26px] leading-none font-bold tabular-nums text-[#2B2338]">
            {value}
          </p>
        )}
        <p className="mt-2 text-[15px] leading-tight font-semibold text-[#2B2338]">{label}</p>
        {detalle && (
          <p className={cn('text-[13px] leading-tight text-[#6B6478]', detalleClassName)}>
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
        'gap-0 rounded-[24px] border-0 bg-white py-0 shadow-[0_14px_34px_rgba(24,16,40,0.12)]',
        className,
      )}
    >
      {(titulo || accion) && (
        <CardHeader className={cn('px-5 pt-5 pb-0', headerClassName)}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              {Icono && (
                <span
                  className={cn(
                    'flex size-12 shrink-0 items-center justify-center rounded-[13px]',
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
                    className={cn('text-[17px] font-semibold text-[#2B2338]', tituloClassName)}
                  >
                    {titulo}
                  </CardTitle>
                )}
                {descripcion && (
                  <CardDescription className="text-[14px] leading-snug text-[#6B6478]">
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
        'flex flex-col gap-4 rounded-[18px] bg-[#FDF0E8] p-5 shadow-[0_10px_26px_rgba(24,16,40,0.08)] sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-[#E7A33C] text-[#D98A2B]">
          <CircleAlertIcon aria-hidden="true" className="size-6" />
        </span>
        <div>
          <p className="text-[17px] font-semibold text-[#2B2338]">{titulo}</p>
          <p className="mt-1 text-[15px] text-[#5F586B]">{descripcion}</p>
        </div>
      </div>
      {accion}
    </div>
  )
}
