import {
  ClockIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UserPlusIcon,
} from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { DocentesMateria } from '@/modules/academico/components/docentes-materia'
import { BotonIcono } from '@/modules/academico/components/boton-icono'
import type { AsignacionDocente, DocenteDeMateria, MateriaCurso } from '@/modules/academico/types'
import { colorMateria, formatearFranjaLegible } from '@/modules/academico/utils'

interface MateriaCursoCardProps {
  materiaCurso: MateriaCurso
  /** Docentes asignados en el ciclo actual. */
  docentes: DocenteDeMateria[]
  /** Nombres de las otras materias de la división con las que se pisa el horario. */
  conflictos?: string[]
  puedeEditar: boolean
  onEditar: (materiaCurso: MateriaCurso) => void
  onQuitar: (materiaCurso: MateriaCurso) => void
  onAsignarDocente?: (materiaCurso: MateriaCurso) => void
  onEditarAsignacion?: (asignacion: AsignacionDocente) => void
  onQuitarAsignacion?: (asignacion: AsignacionDocente) => void
  onVerHorario?: (materiaCurso: MateriaCurso) => void
}

function Aviso({ tono, children }: { tono: 'advertencia' | 'error'; children: ReactNode }) {
  return (
    <p
      className={`flex items-center gap-1.5 text-sm font-medium ${
        tono === 'error' ? 'text-error' : 'text-advertencia'
      }`}
    >
      <TriangleAlertIcon className="size-4 shrink-0" aria-hidden="true" />
      {children}
    </p>
  )
}

export function MateriaCursoCard({
  materiaCurso,
  docentes,
  conflictos = [],
  puedeEditar,
  onEditar,
  onQuitar,
  onAsignarDocente,
  onEditarAsignacion,
  onQuitarAsignacion,
  onVerHorario,
}: MateriaCursoCardProps) {
  // Controlado: al ir al horario la tarjeta se desmonta y el tooltip abierto quedaba flotando.
  const [verHorarioAbierto, setVerHorarioAbierto] = useState(false)
  const nombre = materiaCurso.materia_nombre ?? '—'
  const tipo = materiaCurso.materia_tipo === 'taller' ? 'taller' : 'materia'
  const color = colorMateria(materiaCurso.materia_color)
  const accionesDocentes =
    puedeEditar && onAsignarDocente && onEditarAsignacion && onQuitarAsignacion
      ? {
          onEditar: onEditarAsignacion,
          onQuitar: onQuitarAsignacion,
        }
      : undefined
  const franjas = (
    <span className="flex flex-col">
      {materiaCurso.horarios.map((horario) => (
        <span key={horario.id}>{formatearFranjaLegible(horario)}</span>
      ))}
    </span>
  )
  return (
    <Card size="sm" className="justify-between gap-3 border-l-4" style={color.estiloBorde}>
      <div className="flex flex-col gap-2 px-(--card-spacing)">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-base leading-snug font-semibold text-texto">{nombre}</h3>
            <p className="text-sm text-texto-3">{tipo === 'taller' ? 'Taller' : 'Materia'}</p>
          </div>
          {puedeEditar && (
            <div className="-mt-1 -mr-1.5 flex shrink-0 items-center">
              {docentes.length > 0 && onAsignarDocente && (
                <BotonIcono
                  etiqueta="Agregar docente"
                  onClick={() => onAsignarDocente(materiaCurso)}
                >
                  <UserPlusIcon />
                </BotonIcono>
              )}
              <BotonIcono
                etiqueta={`Editar ${tipo} y horario`}
                onClick={() => onEditar(materiaCurso)}
              >
                <PencilIcon />
              </BotonIcono>
              <BotonIcono
                etiqueta={`Eliminar ${tipo}`}
                className="hover:text-error"
                onClick={() => onQuitar(materiaCurso)}
              >
                <Trash2Icon />
              </BotonIcono>
            </div>
          )}
        </div>
        {materiaCurso.horarios.length === 0 ? (
          <Aviso tono="advertencia">Sin horario</Aviso>
        ) : onVerHorario ? (
          <TooltipProvider>
            <Tooltip open={verHorarioAbierto} onOpenChange={setVerHorarioAbierto}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="flex w-fit max-w-full cursor-pointer items-start gap-2 text-left text-sm text-texto-2 hover:text-texto hover:underline focus-visible:outline-2 focus-visible:outline-violeta"
                  onClick={() => {
                    setVerHorarioAbierto(false)
                    onVerHorario(materiaCurso)
                  }}
                >
                  <ClockIcon className="mt-0.5 size-4 shrink-0 text-texto-3" aria-hidden="true" />
                  {franjas}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                Ver en el horario
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <div className="flex items-start gap-2 text-sm text-texto-2">
            <ClockIcon className="mt-0.5 size-4 shrink-0 text-texto-3" aria-hidden="true" />
            {franjas}
          </div>
        )}
        {conflictos.length > 0 && (
          <Aviso tono="error">Se superpone con {conflictos.join(', ')}</Aviso>
        )}
        {docentes.length > 0 ? (
          <DocentesMateria docentes={docentes} materia={nombre} acciones={accionesDocentes} />
        ) : (
          <Aviso tono="advertencia">Sin docente asignado</Aviso>
        )}
      </div>
      {puedeEditar && docentes.length === 0 && onAsignarDocente && (
        <div className="px-(--card-spacing)">
          <Button
            variant="secondary"
            size="sm"
            aria-label={`Asignar docente a ${nombre}`}
            onClick={() => onAsignarDocente(materiaCurso)}
          >
            <UserPlusIcon />
            Asignar
          </Button>
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
