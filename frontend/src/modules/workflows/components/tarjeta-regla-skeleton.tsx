import { Skeleton } from '@/components/ui/skeleton'

/** Misma estructura que `TarjetaRegla`; `indice` alterna anchos para que no sean todas iguales. */
export function TarjetaReglaSkeleton({ indice }: { indice: number }) {
  const par = indice % 2 === 0
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-3 rounded-card-sm bg-superficie p-4 shadow-card"
    >
      <div className="flex items-start justify-between gap-2">
        <Skeleton className={par ? 'h-5 w-48' : 'h-5 w-36'} />
        <div className="flex items-center gap-1">
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className="size-9 rounded-full" />
        </div>
      </div>
      <Skeleton className="-mt-2.5 mb-1 h-[22px] w-24 rounded-full" />
      <Skeleton className="h-28 w-full" />
      <div className="flex flex-col gap-1.5">
        <Skeleton className={par ? 'h-4 w-3/4' : 'h-4 w-2/3'} />
        <Skeleton className={par ? 'h-4 w-full' : 'h-4 w-5/6'} />
        <Skeleton className={par ? 'h-4 w-5/6' : 'h-4 w-full'} />
      </div>
      <div className="mt-auto flex flex-col gap-1.5 border-t border-borde pt-3">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  )
}
