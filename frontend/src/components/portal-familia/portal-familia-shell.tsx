import type { ReactNode } from 'react'
import { ArrowLeftIcon } from 'lucide-react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'

// Mundo visual del Portal Familia: gradiente aprobado en el home y reutilizado por el shell
// de todas las pantallas familiares. Vive en el componente, nunca en index.css ni en tokens.
export const PORTAL_FAMILIA_BACKGROUND =
  'linear-gradient(180deg, #4A3A63 0%, #4F3E6A 45%, #53426C 70%, #51406A 100%)'
export const PORTAL_FAMILIA_GLOW_DERECHO =
  'radial-gradient(ellipse 58% 52% at 88% 26%, rgba(114, 93, 143, 0.7) 0%, rgba(114, 93, 143, 0) 70%)'
export const PORTAL_FAMILIA_GLOW_CENTRAL =
  'radial-gradient(ellipse 46% 34% at 46% 30%, rgba(112, 88, 140, 0.28) 0%, rgba(112, 88, 140, 0) 72%)'

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
  tituloClassName?: string
}

/** Banda oscura común a todo el portal familiar: título, subtítulo y acciones. */
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

      <div className={cn('relative mx-auto flex w-full flex-col gap-5', anchoMaximo)}>
        {volverA && (
          <Link
            to={volverA}
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-white/70 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <ArrowLeftIcon aria-hidden="true" className="size-4" />
            {volverEtiqueta}
          </Link>
        )}

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            {icono && (
              <span className="flex size-16 shrink-0 items-center justify-center rounded-[18px] border border-white/20 bg-white/15 text-white">
                {icono}
              </span>
            )}
            <div className="min-w-0">
              {etiqueta && (
                <p className="text-xs font-bold tracking-[0.08em] text-[#CFC4DE] uppercase">
                  {etiqueta}
                </p>
              )}
              <h1
                className={cn(
                  'font-heading text-[30px] leading-[1.15] font-bold tracking-[-0.02em] text-white sm:text-[36px]',
                  tituloClassName,
                )}
              >
                {titulo}
              </h1>
              {descripcion && (
                <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[#CFC4DE] sm:text-[16px]">
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
