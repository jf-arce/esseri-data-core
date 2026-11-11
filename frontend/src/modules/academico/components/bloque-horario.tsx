import { useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { PencilIcon, Trash2Icon, TriangleAlertIcon, UserPlusIcon } from 'lucide-react'
import { BotonIcono } from '@/modules/academico/components/boton-icono'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Spinner } from '@/components/ui/spinner'
import type { FranjaConMateria } from '@/modules/academico/types'
import {
  abreviarDocentes,
  aMinutos,
  colorMateria,
  DIAS,
  rangoLegible,
} from '@/modules/academico/utils'

interface BloqueHorarioProps {
  franja: FranjaConMateria
  docentes: string[]
  superpuesto: boolean
  /** Posición vertical dentro de la columna del día, en porcentaje. */
  top: number
  alto: number
  carril: number
  carriles: number
  puedeEditar: boolean
  guardando: boolean
  /** Más tenue: hay otra materia resaltada o este bloque se está moviendo. */
  atenuado: boolean
  descripcionId?: string
  onEditar: () => void
  onEliminar: () => void
  onAsignarDocente?: () => void
  onResaltar: (materiaCursoId: string | null) => void
  onIniciarMover: (evento: PointerEvent<HTMLElement>) => void
  onIniciarEstirar: (evento: PointerEvent<HTMLElement>) => void
  onTecla: (evento: KeyboardEvent<HTMLElement>) => void
  /** `true` si el clic que llega es el final de un arrastre. */
  esFinDeArrastre: () => boolean
  onContextMenu: (evento: MouseEvent<HTMLElement>) => void
}

export function BloqueHorario({
  franja,
  docentes,
  superpuesto,
  top,
  alto,
  carril,
  carriles,
  puedeEditar,
  guardando,
  atenuado,
  descripcionId,
  onEditar,
  onEliminar,
  onAsignarDocente,
  onResaltar,
  onIniciarMover,
  onIniciarEstirar,
  onTecla,
  esFinDeArrastre,
  onContextMenu,
}: BloqueHorarioProps) {
  const [abierto, setAbierto] = useState(false)
  const { materiaCurso } = franja
  const nombre = materiaCurso.materia_nombre ?? 'Materia'
  const color = colorMateria(materiaCurso.materia_color)
  const rango = rangoLegible(franja)
  const tipo = materiaCurso.materia_tipo === 'taller' ? 'taller' : 'materia'
  const textoDocentes = docentes.length > 0 ? docentes.join(', ') : 'Sin docente asignado'
  const minutos = aMinutos(franja.hora_fin) - aMinutos(franja.hora_inicio)
  const inicio = franja.hora_inicio.slice(0, 5)
  const fin = franja.hora_fin.slice(0, 5)
  const docenteCorto = abreviarDocentes(docentes)
  const sinDocenteAviso = minutos < 60 && !docenteCorto
  const arrastrable = puedeEditar && !guardando
  const etiqueta = `${nombre}, ${DIAS[franja.dia_semana - 1]} de ${rango}, ${textoDocentes}${
    superpuesto ? ' (horario superpuesto)' : ''
  }`

  return (
    <div
      data-bloque
      className={`pointer-events-auto absolute z-10 transition-opacity ${atenuado ? 'opacity-35' : ''}`}
      style={{
        top: `${top}%`,
        height: `${alto}%`,
        left: `${(carril / carriles) * 100}%`,
        width: `${100 / carriles}%`,
      }}
      onMouseEnter={() => onResaltar(materiaCurso.id)}
      onMouseLeave={() => onResaltar(null)}
    >
      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={etiqueta}
            aria-describedby={puedeEditar ? descripcionId : undefined}
            className={`flex size-full min-w-0 flex-col items-start overflow-hidden border py-1 pl-2 ${sinDocenteAviso ? 'pr-5' : 'pr-2'} text-left text-xs leading-tight select-none [-webkit-touch-callout:none] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-violeta ${
              superpuesto ? 'border-error bg-error-suave text-error' : 'border-transparent'
            } ${arrastrable ? 'cursor-grab' : 'cursor-pointer'}`}
            style={superpuesto ? undefined : color.estilo}
            onFocus={() => onResaltar(materiaCurso.id)}
            onBlur={() => onResaltar(null)}
            onPointerDown={arrastrable ? onIniciarMover : undefined}
            onKeyDown={arrastrable ? onTecla : undefined}
            onContextMenu={onContextMenu}
            onClick={(evento) => {
              if (esFinDeArrastre()) evento.preventDefault()
            }}
          >
            {minutos < 45 ? (
              <span className="truncate">
                <span className="font-semibold">{nombre}</span>
                <span className="opacity-75"> · {inicio}</span>
              </span>
            ) : (
              <>
                <span className="w-full truncate font-semibold">{nombre}</span>
                <span className="w-full truncate opacity-75">
                  {inicio} a {fin}
                </span>
                {minutos >= 60 &&
                  (docenteCorto ? (
                    <span className="w-full truncate opacity-75">{docenteCorto}</span>
                  ) : (
                    <span className="flex w-full items-center gap-1 font-medium">
                      <TriangleAlertIcon className="size-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">Sin docente</span>
                    </span>
                  ))}
              </>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64">
          <PopoverHeader>
            <PopoverTitle>{nombre}</PopoverTitle>
            <PopoverDescription>
              {materiaCurso.materia_tipo === 'taller' ? 'Taller' : 'Materia'}
            </PopoverDescription>
          </PopoverHeader>
          <div className="flex flex-col gap-0.5">
            <span className="capitalize">{DIAS[franja.dia_semana - 1]}</span>
            <span className="text-texto-2">{rango}</span>
          </div>
          {docentes.length > 0 ? (
            <p className="text-texto-2">{textoDocentes}</p>
          ) : (
            <p className="flex items-center gap-1.5 font-medium text-advertencia">
              <TriangleAlertIcon className="size-4 shrink-0" aria-hidden="true" />
              Sin docente asignado
            </p>
          )}
          {puedeEditar && (
            <div className="flex gap-2">
              {docentes.length === 0 && onAsignarDocente && (
                <BotonIcono
                  variant="secondary"
                  etiqueta="Asignar docente"
                  onClick={() => {
                    setAbierto(false)
                    onAsignarDocente()
                  }}
                >
                  <UserPlusIcon />
                </BotonIcono>
              )}
              <BotonIcono
                variant="secondary"
                etiqueta={`Editar ${tipo}`}
                onClick={() => {
                  setAbierto(false)
                  onEditar()
                }}
              >
                <PencilIcon />
              </BotonIcono>
              <BotonIcono
                etiqueta={`Eliminar ${tipo}`}
                className="text-error hover:text-error"
                onClick={() => {
                  setAbierto(false)
                  onEliminar()
                }}
              >
                <Trash2Icon />
              </BotonIcono>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {sinDocenteAviso && !guardando && (
        <TriangleAlertIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1 right-1 size-3.5"
          style={superpuesto ? undefined : { color: color.estilo.color }}
        />
      )}
      {guardando && <Spinner aria-label="Guardando" className="absolute top-1 right-1 size-3.5" />}
      {arrastrable && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
          onPointerDown={(evento) => {
            evento.stopPropagation()
            onIniciarEstirar(evento)
          }}
        />
      )}
    </div>
  )
}
