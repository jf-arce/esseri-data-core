import { BookOpenIcon, PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

export function EstadoVacio({
  titulo,
  descripcion,
  accion,
  onAccion,
}: {
  titulo: string
  descripcion: string
  accion?: string
  onAccion?: () => void
}) {
  return (
    <Empty className="min-h-[240px]">
      <EmptyMedia variant="icon" className="bg-sup-academico text-info">
        <BookOpenIcon />
      </EmptyMedia>
      <EmptyTitle>{titulo}</EmptyTitle>
      <EmptyDescription>{descripcion}</EmptyDescription>
      {accion && onAccion && (
        <Button onClick={onAccion}>
          <PlusIcon />
          {accion}
        </Button>
      )}
    </Empty>
  )
}
