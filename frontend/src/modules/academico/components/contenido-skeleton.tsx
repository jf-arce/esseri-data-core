import { PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AgregarMateriaCard } from '@/modules/academico/components/materia-curso-card'
import { VistaTabs, type Vista } from '@/modules/academico/components/vista-tabs'

export function ContenidoSkeleton({
  vista,
  onVista,
  conAcciones,
}: {
  vista: Vista
  onVista: (vista: Vista) => void
  conAcciones: boolean
}) {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Cargando">
      <div className="flex items-baseline gap-3">
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-5 w-20" />
      </div>
      <VistaTabs vista={vista} onChange={onVista} />
      {vista === 'horario' ? (
        <div className="flex flex-col gap-3">
          {conAcciones && (
            <Button variant="secondary" size="sm" className="self-start" disabled>
              <PlusIcon />
              Agregar materia
            </Button>
          )}
          <Skeleton className="h-[26rem] w-full" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: conAcciones ? 2 : 3 }, (_, i) => i).map((i) => (
            <Skeleton key={i} className={conAcciones ? 'h-[9.5rem]' : 'h-28'} />
          ))}
          {conAcciones && <AgregarMateriaCard disabled onAgregar={() => {}} />}
        </div>
      )}
    </div>
  )
}
