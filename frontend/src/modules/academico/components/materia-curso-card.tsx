import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { BotonIcono } from '@/modules/academico/components/boton-icono'
import type { MateriaCurso } from '@/modules/academico/types'
import { colorMateria, formatearFranjaLegible } from '@/modules/academico/utils'

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
  const color = colorMateria(materiaCurso.materia_color)
  return (
    <Card size="sm" className="justify-between gap-4 border-l-4" style={color.estiloBorde}>
      <div className="flex flex-col gap-1.5 px-(--card-spacing)">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold text-texto">{nombre}</h3>
          <Badge variant={materiaCurso.materia_tipo === 'taller' ? 'info' : 'neutro'}>
            {materiaCurso.materia_tipo === 'taller' ? 'Taller' : 'Materia'}
          </Badge>
        </div>
        <p className="text-sm text-texto-2">
          {materiaCurso.horarios.length > 0
            ? materiaCurso.horarios.map(formatearFranjaLegible).join(' · ')
            : 'Sin horario'}
        </p>
        <p className="text-sm text-texto-3">
          {docentes.length > 0 ? docentes.join(', ') : 'Sin docente asignado'}
        </p>
      </div>
      {puedeEditar && (
        <div className="flex gap-2 px-(--card-spacing)">
          <BotonIcono
            etiqueta={`Editar ${nombre}`}
            variant="secondary"
            onClick={() => onEditar(materiaCurso)}
          >
            <PencilIcon />
          </BotonIcono>
          <BotonIcono
            etiqueta={`Quitar ${nombre} del curso`}
            className="text-error hover:text-error"
            onClick={() => onQuitar(materiaCurso)}
          >
            <Trash2Icon />
          </BotonIcono>
        </div>
      )}
    </Card>
  )
}

export function AgregarMateriaCard({
  onAgregar,
  disabled = false,
}: {
  onAgregar: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onAgregar}
      disabled={disabled}
      className="flex min-h-[9.5rem] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 flex-col items-center justify-center gap-1.5 rounded-card border-2 border-dashed border-borde text-sm font-semibold text-texto-2 transition-colors hover:bg-fila-hover hover:text-texto focus-visible:outline-2 focus-visible:outline-violeta"
    >
      <PlusIcon className="size-5" />
      Agregar materia
    </button>
  )
}
