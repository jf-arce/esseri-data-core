import { HistoryIcon } from 'lucide-react'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

interface HistorialCambiosProps {
  entidad: string
  entidadId: string
}

// Componente compartido de auditoría (RF-03). El backend de audit_log todavía no está
// conectado — este componente muestra un empty state hasta que lo esté.
// TODO: Conectar con el endpoint de audit_log cuando esté disponible.
export function HistorialCambios({ entidad, entidadId }: HistorialCambiosProps) {
  void entidad
  void entidadId

  return (
    <Empty className="rounded-card bg-superficie shadow-card min-h-[280px]">
      <EmptyMedia variant="neutral">
        <HistoryIcon />
      </EmptyMedia>
      <EmptyTitle>No hay cambios registrados</EmptyTitle>
      <EmptyDescription>
        El historial de cambios aparecerá acá cuando el módulo de auditoría esté conectado.
      </EmptyDescription>
    </Empty>
  )
}
