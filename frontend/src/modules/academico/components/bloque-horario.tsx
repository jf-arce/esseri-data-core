import { useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import {
  ClockIcon,
  CopyIcon,
  PencilIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UserIcon,
  UserPlusIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BotonIcono } from '@/modules/academico/components/boton-icono'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
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
  franjasSeSuperponen,
  rangoLegible,
} from '@/modules/academico/utils'

const ESPERA_RESALTADO_MS = 120

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
  /** Copia esta franja al día indicado (1 = lunes). */
  onDuplicar?: (dia: number) => void
  /** Elimina solo esta franja; `onEliminar` borra la materia entera. */
  onEliminarFranja?: () => void
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
  onDuplicar,
  onEliminarFranja,
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
  // La materia necesita al menos un horario: con uno solo, eliminarlo es eliminar la materia.
  const eliminaSoloFranja = onEliminarFranja !== undefined && materiaCurso.horarios.length > 1
  // Con el mouse, el resto se atenúa solo si se mantiene el clic un momento (un clic corto abre
  // el popover sin atenuar nada).
  function resaltarMientrasSePresiona() {
    const espera = window.setTimeout(() => onResaltar(materiaCurso.id), ESPERA_RESALTADO_MS)
    const soltar = () => {
      window.clearTimeout(espera)
      onResaltar(null)
      window.removeEventListener('pointerup', soltar)
      window.removeEventListener('pointercancel', soltar)
    }
    window.addEventListener('pointerup', soltar)
    window.addEventListener('pointercancel', soltar)
  }
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
    >
      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={etiqueta}
            aria-describedby={puedeEditar ? descripcionId : undefined}
            className={`flex size-full min-w-0 flex-col items-start overflow-hidden border py-1 pl-2 ${sinDocenteAviso ? 'pr-5' : 'pr-2'} text-left text-xs leading-tight select-none [-webkit-touch-callout:none] hover:brightness-90 hover:shadow-md focus-visible:outline-2 focus-visible:outline-violeta ${
              superpuesto ? 'border-error bg-error-suave text-error' : 'border-transparent'
            } ${arrastrable ? 'cursor-grab' : 'cursor-pointer'}`}
            style={superpuesto ? undefined : color.estilo}
            onFocus={(evento) => {
              if (evento.currentTarget.matches(':focus-visible')) onResaltar(materiaCurso.id)
            }}
            onBlur={() => onResaltar(null)}
            onPointerDown={(evento) => {
              resaltarMientrasSePresiona()
              if (arrastrable) onIniciarMover(evento)
            }}
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
        <PopoverContent
          align="start"
          className="w-72 gap-3"
          // Sin esto el foco salta al botón de editar y se abre su tooltip solo.
          onOpenAutoFocus={(evento) => evento.preventDefault()}
        >
          <div className="flex items-start gap-2">
            <span
              aria-hidden="true"
              className="mt-1 size-3 shrink-0 rounded-sm"
              style={{ backgroundColor: color.estilo.backgroundColor }}
            />
            <div className="min-w-0 flex-1">
              <PopoverTitle className="leading-snug">{nombre}</PopoverTitle>
              <PopoverDescription>{tipo === 'taller' ? 'Taller' : 'Materia'}</PopoverDescription>
            </div>
            {puedeEditar && (
              <div className="-mt-1 -mr-1 flex shrink-0 items-center">
                <BotonIcono
                  etiqueta={`Editar ${tipo}`}
                  onClick={() => {
                    setAbierto(false)
                    onEditar()
                  }}
                >
                  <PencilIcon />
                </BotonIcono>
                <BotonIcono
                  etiqueta={eliminaSoloFranja ? 'Eliminar horario' : `Eliminar ${tipo}`}
                  className="hover:text-error"
                  onClick={() => {
                    setAbierto(false)
                    if (eliminaSoloFranja) onEliminarFranja()
                    else onEliminar()
                  }}
                >
                  <Trash2Icon />
                </BotonIcono>
              </div>
            )}
          </div>
          <div className="flex items-start gap-2 text-texto-2">
            <ClockIcon className="mt-0.5 size-4 shrink-0 text-texto-3" aria-hidden="true" />
            <p>
              <span className="capitalize">{DIAS[franja.dia_semana - 1]}</span>, {rango}
            </p>
          </div>
          <div className="flex items-start gap-2">
            {docentes.length > 0 ? (
              <>
                <UserIcon className="mt-0.5 size-4 shrink-0 text-texto-3" aria-hidden="true" />
                <p className="text-texto-2">{textoDocentes}</p>
              </>
            ) : (
              <>
                <TriangleAlertIcon
                  className="mt-0.5 size-4 shrink-0 text-advertencia"
                  aria-hidden="true"
                />
                <p className="flex-1 font-medium text-advertencia">Sin docente asignado</p>
              </>
            )}
          </div>
          {docentes.length === 0 && puedeEditar && onAsignarDocente && (
            <Button
              variant="secondary"
              size="sm"
              aria-label="Asignar docente"
              className="self-start"
              onClick={() => {
                setAbierto(false)
                onAsignarDocente()
              }}
            >
              <UserPlusIcon />
              Asignar
            </Button>
          )}
          {puedeEditar && onDuplicar && (
            <div className="flex items-start gap-2">
              <CopyIcon className="mt-1.5 size-4 shrink-0 text-texto-3" aria-hidden="true" />
              <div className="flex flex-col gap-1">
                <span className="text-texto-2">Duplicar en</span>
                <div className="flex flex-wrap gap-1">
                  {DIAS.slice(0, 5).map((nombreDia, i) => {
                    const dia = i + 1
                    const ocupado = materiaCurso.horarios.some((otra) =>
                      franjasSeSuperponen(otra, { ...franja, dia_semana: dia }),
                    )
                    return (
                      <Button
                        key={dia}
                        variant="secondary"
                        size="sm"
                        disabled={ocupado}
                        aria-label={`Duplicar el ${nombreDia}`}
                        className="capitalize"
                        onClick={() => {
                          setAbierto(false)
                          onDuplicar(dia)
                        }}
                      >
                        {nombreDia.slice(0, 3)}
                      </Button>
                    )
                  })}
                </div>
              </div>
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
