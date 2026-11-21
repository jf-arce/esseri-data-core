import { Skeleton } from '@/components/ui/skeleton'

const COLUMNAS = '@3xl/main:grid-cols-[minmax(0,1fr)_32px_minmax(0,1.1fr)_32px_minmax(0,1.1fr)]'

/** Esqueleto del mapa: filtros de módulo y dos carriles de Evento → Regla → Qué hace. */
export function MapaSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status">
      <span className="sr-only">Cargando el mapa de automatizaciones</span>
      <div aria-hidden="true" className="flex flex-wrap gap-2">
        {[16, 24, 20, 28].map((ancho) => (
          <Skeleton key={ancho} className="h-8 rounded-full" style={{ width: `${ancho * 4}px` }} />
        ))}
      </div>
      {[0, 1].map((carril) => (
        <section
          key={carril}
          aria-hidden="true"
          className="rounded-panel bg-superficie p-4 shadow-card"
        >
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-56" />
          </div>
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((fila) => (
              <div key={fila} className={`grid gap-2 @3xl/main:gap-x-2 ${COLUMNAS}`}>
                <Skeleton className="h-10 rounded-card-sm @3xl/main:self-center" />
                <span className="hidden @3xl/main:block" />
                <Skeleton className="h-14 rounded-card-sm" />
                <span className="hidden @3xl/main:block" />
                <Skeleton className="h-10 rounded-card-sm @3xl/main:self-center" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
