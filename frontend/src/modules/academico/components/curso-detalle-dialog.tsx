import { ClockIcon, PencilIcon, PlusIcon, Trash2Icon, UserRoundIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { DivisionConMaterias } from '@/modules/academico/hooks/use-estructura-academica'
import type { MateriaCurso } from '@/modules/academico/types'
import { formatearHorarios, pluralizar } from '@/modules/academico/utils'

interface CursoDetalleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  division: DivisionConMaterias | null
  nivelNombre: string
  anioNumero: number
  puedeEditar: boolean
  onAgregarMateriaCurso: (division: DivisionConMaterias) => void
  onEditarMateriaCurso: (materiaCurso: MateriaCurso) => void
  onEliminarMateriaCurso: (materiaCurso: MateriaCurso) => void
}

export function CursoDetalleDialog({
  open,
  onOpenChange,
  division,
  nivelNombre,
  anioNumero,
  puedeEditar,
  onAgregarMateriaCurso,
  onEditarMateriaCurso,
  onEliminarMateriaCurso,
}: CursoDetalleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{division?.nombre ?? 'Curso'}</DialogTitle>
          <DialogDescription>
            {nivelNombre} · {anioNumero}° año ·{' '}
            {pluralizar(division?.materias.length ?? 0, 'materia', 'materias')} ·{' '}
            {pluralizar(division?.cantidad_inscripciones ?? 0, 'alumno', 'alumnos')}
          </DialogDescription>
        </DialogHeader>

        {division && division.materias.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {division.materias.map((materia) => (
              <li
                key={materia.id}
                className="rounded-lg border border-borde bg-superficie p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={
                          materia.materia_tipo === 'taller'
                            ? 'rounded bg-sup-workflows px-1.5 py-0.5 text-xs font-semibold text-violeta'
                            : 'rounded bg-sup-academico px-1.5 py-0.5 text-xs font-semibold text-info'
                        }
                      >
                        {materia.materia_tipo === 'taller' ? 'Taller' : 'Materia'}
                      </span>
                      <span className="font-medium text-texto">
                        {materia.materia_nombre ?? '—'}
                      </span>
                    </div>
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-texto-2">
                      <ClockIcon className="size-3.5 shrink-0" aria-hidden="true" />
                      {formatearHorarios(materia.horarios)}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-texto-2">
                      <UserRoundIcon className="size-3.5 shrink-0" aria-hidden="true" />
                      {materia.docentes.length > 0
                        ? materia.docentes.join(' · ')
                        : 'Sin docente asignado'}
                    </p>
                  </div>
                  {puedeEditar && (
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onEditarMateriaCurso(materia)}
                        aria-label="Editar materia"
                      >
                        <PencilIcon className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-texto-3 hover:text-error"
                        onClick={() => onEliminarMateriaCurso(materia)}
                        aria-label="Eliminar materia"
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-borde p-4 text-sm text-texto-3">
            Este curso no tiene materias asignadas.
          </p>
        )}

        {puedeEditar && division && (
          <div className="flex justify-end">
            <Button variant="secondary" size="sm" onClick={() => onAgregarMateriaCurso(division)}>
              <PlusIcon className="size-3.5" />
              Agregar materia
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
