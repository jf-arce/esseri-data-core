import type { ReactNode } from 'react'
import { ArrowLeftIcon } from 'lucide-react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'

// Family portal colors stay scoped here, without changing the staff theme tokens.
export const PORTAL_FAMILIA_BACKGROUND = 'var(--pf-canvas)'
export const PORTAL_FAMILIA_HEADER_BACKGROUND = 'var(--pf-header)'

type PortalFamiliaShellProps = {
  titulo: ReactNode
  descripcion?: ReactNode
  etiqueta?: string
  volverA?: string
  volverEtiqueta?: string
  acciones?: ReactNode
  ilustracion?: ReactNode
  icono?: ReactNode
  anchoMaximo?: string
  className?: string
  classNameContenido?: string
  tituloClassName?: string
}

/** Shared title, description and actions on the light family portal canvas. */
export function PortalFamiliaShell({
  titulo,
  descripcion,
  etiqueta,
  volverA,
  volverEtiqueta = 'Volver',
  acciones,
  ilustracion,
  icono,
  anchoMaximo = 'max-w-[92vw]',
  className,
  classNameContenido,
  tituloClassName,
}: PortalFamiliaShellProps) {
  return (
    <section
      data-slot="portal-familia-shell"
      className={cn(
        'relative -mx-4 -mt-6 overflow-hidden px-4 pt-10 pb-14 sm:-mx-8 sm:px-8',
        className,
      )}
    >
      {ilustracion && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-2 right-0 hidden w-[34rem] max-w-[46%] opacity-90 lg:block"
        >
          {ilustracion}
        </div>
      )}

      <div
        className={cn(
          'relative mx-auto flex w-full flex-col gap-5',
          anchoMaximo,
          classNameContenido,
        )}
      >
        {volverA && (
          <Link
            to={volverA}
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-pf-accent transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-accent"
          >
            <ArrowLeftIcon aria-hidden="true" className="size-4" />
            {volverEtiqueta}
          </Link>
        )}

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            {icono && (
              <span className="flex size-16 shrink-0 items-center justify-center rounded-pf-tile border border-pf-borde bg-superficie text-pf-accent">
                {icono}
              </span>
            )}
            <div className="min-w-0">
              {etiqueta && (
                <p className="text-xs font-bold tracking-[0.08em] text-texto-2 uppercase">
                  {etiqueta}
                </p>
              )}
              <h1
                className={cn(
                  'font-heading text-pf-titulo font-bold tracking-[-0.02em] text-texto sm:text-pf-titulo-lg',
                  tituloClassName,
                )}
              >
                {titulo}
              </h1>
              {descripcion && (
                <p className="mt-2 max-w-2xl text-pf-cuerpo leading-relaxed text-texto-2">
                  {descripcion}
                </p>
              )}
            </div>
          </div>
          {acciones && (
            <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">{acciones}</div>
          )}
        </div>
      </div>
    </section>
  )
}
