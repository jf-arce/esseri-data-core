import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { MateriaCurso } from '@/modules/academico/types'
import { formatearHorarios } from '@/modules/academico/utils'

interface MateriaCursoCardProps {
  materiaCurso: MateriaCurso
  /** Nombres de los docentes asignados en el ciclo actual. */
  docentes: string[]
  puedeEditar: boolean
  onEditar: (materiaCurso: MateriaCurso) => void
  onQuitar: (materiaCurso: MateriaCurso) => void
}

export function MateriaCursoCard({
  materiaCurso,
  docentes,
  puedeEditar,
  onEditar,
  onQuitar,
}: MateriaCursoCardProps) {
  const nombre = materiaCurso.materia_nombre ?? '—'
  return (
    <Card size="sm" className="justify-between gap-3">
      <div className="flex flex-col gap-1.5 px-(--card-spacing)">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold text-texto">{nombre}</h3>
          <Badge variant={materiaCurso.materia_tipo === 'taller' ? 'info' : 'neutro'}>
            {materiaCurso.materia_tipo === 'taller' ? 'Taller' : 'Materia'}
          </Badge>
        </div>
        <p className="text-sm text-texto-2">{formatearHorarios(materiaCurso.horarios)}</p>
        <p className="text-sm text-texto-3">
          {docentes.length > 0 ? docentes.join(', ') : 'Sin docente asignado'}
        </p>
      </div>
      {puedeEditar && (
        <div className="flex gap-2 px-(--card-spacing)">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onEditar(materiaCurso)}
            aria-label={`Editar ${nombre}`}
          >
            <PencilIcon />
            Editar
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-error hover:text-error"
            onClick={() => onQuitar(materiaCurso)}
            aria-label={`Quitar ${nombre}`}
            title="Quitar del curso"
          >
            <Trash2Icon />
          </Button>
        </div>
      )}
    </Card>
  )
}

export function AgregarMateriaCard({ onAgregar }: { onAgregar: () => void }) {
  return (
    <button
      type="button"
      onClick={onAgregar}
      className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-card border-2 border-dashed border-borde text-sm font-semibold text-texto-2 transition-colors hover:bg-fila-hover hover:text-texto focus-visible:outline-2 focus-visible:outline-violeta"
    >
      <PlusIcon className="size-5" />
      Agregar materia
    </button>
  )
}
