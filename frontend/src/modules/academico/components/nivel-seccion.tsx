import {
  BookOpenIcon,
  ChevronRightIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CursoDetalleDialog } from '@/modules/academico/components/curso-detalle-dialog'
import type {
  AnioConDivisiones,
  DivisionConMaterias,
  NivelConEstructura,
} from '@/modules/academico/hooks/use-estructura-academica'
import type { Anio, Division, MateriaCurso, NivelEducativo } from '@/modules/academico/types'
import { pluralizar } from '@/modules/academico/utils'

interface NivelSeccionProps {
  nivel: NivelConEstructura
  /** Sin esto (ej. dirección, que solo mira la estructura), se ocultan todos los triggers de
   * escritura de esta sección y sus hijos — no solo se deshabilitan. */
  puedeEditar: boolean
  onEditarNivel: (nivel: NivelEducativo) => void
  onEliminarNivel: (nivel: NivelEducativo) => void
  onAgregarAnio: (nivelId: string) => void
  onEditarAnio: (anio: Anio) => void
  onEliminarAnio: (anio: Anio) => void
  onAgregarDivision: (anioId: string) => void
  onEditarDivision: (division: Division) => void
  onEliminarDivision: (division: Division) => void
  onAgregarMateriaCurso: (division: DivisionConMaterias) => void
  onEditarMateriaCurso: (materiaCurso: MateriaCurso) => void
  onEliminarMateriaCurso: (materiaCurso: MateriaCurso) => void
}

const COLORES_NIVEL = [
  { sup: 'bg-sup-academico', sat: 'text-info', dark: 'text-info', border: 'border-l-info' },
  {
    sup: 'bg-sup-inscripciones',
    sat: 'text-petroleo',
    dark: 'text-petroleo',
    border: 'border-l-petroleo',
  },
  {
    sup: 'bg-sup-familias',
    sat: 'text-violeta',
    dark: 'text-violeta-esseri',
    border: 'border-l-violeta',
  },
]

export function NivelSeccion(props: NivelSeccionProps) {
  const { nivel, puedeEditar } = props
  const colorIdx = 0
  const [divisionDetalleId, setDivisionDetalleId] = useState<string | null>(null)

  // Los conteos vienen del backend para no depender de lo que se haya cargado en el árbol.
  const totalDivisiones = nivel.anios.reduce((acc, a) => acc + a.cantidad_divisiones, 0)
  const totalMaterias = nivel.anios.reduce((acc, a) => acc + a.cantidad_materias, 0)

  const anioDetalle = nivel.anios.find((anio) =>
    anio.divisiones.some((division) => division.id === divisionDetalleId),
  )
  const divisionDetalle = anioDetalle?.divisiones.find(
    (division) => division.id === divisionDetalleId,
  )

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3.5">
        <div
          className={`flex size-10.5 shrink-0 items-center justify-center rounded-xl ${COLORES_NIVEL[colorIdx].sup} ${COLORES_NIVEL[colorIdx].sat}`}
        >
          <BookOpenIcon className="size-5" />
        </div>
        <div className="flex-1">
          <p className={`text-sm.5 font-semibold ${COLORES_NIVEL[colorIdx].sat}`}>{nivel.nombre}</p>
          <p className={`text-xs ${COLORES_NIVEL[colorIdx].dark}`}>
            {pluralizar(nivel.cantidad_anios, 'año', 'años')} ·{' '}
            {pluralizar(totalDivisiones, 'división', 'divisiones')} ·{' '}
            {pluralizar(totalMaterias, 'materia', 'materias')}
          </p>
        </div>
        {puedeEditar && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Acciones del nivel">
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => props.onAgregarAnio(nivel.id)}>
                <PlusIcon className="text-petroleo" />
                Agregar año
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => props.onEditarNivel(nivel)}>
                <PencilIcon className="text-petroleo" />
                Editar nivel
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => props.onEliminarNivel(nivel)}>
                <Trash2Icon />
                Dar de baja
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {nivel.anios.length === 0 ? (
        <div className="rounded-card bg-superficie p-6 text-center text-sm text-texto-3 shadow-card">
          {puedeEditar ? (
            <>
              No hay años cargados en este nivel.{' '}
              <button
                className="font-semibold text-violeta hover:underline"
                onClick={() => props.onAgregarAnio(nivel.id)}
              >
                Agregar el primer año
              </button>
            </>
          ) : (
            'No hay años cargados en este nivel.'
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {nivel.anios.map((anio) => (
            <AnioGrupo
              key={anio.id}
              anio={anio}
              puedeEditar={puedeEditar}
              onEditarAnio={props.onEditarAnio}
              onEliminarAnio={props.onEliminarAnio}
              onAgregarDivision={props.onAgregarDivision}
              onEditarDivision={props.onEditarDivision}
              onEliminarDivision={props.onEliminarDivision}
              onAgregarMateriaCurso={props.onAgregarMateriaCurso}
              onAbrirDetalle={(division) => setDivisionDetalleId(division.id)}
            />
          ))}
        </div>
      )}

      <CursoDetalleDialog
        open={Boolean(divisionDetalle && anioDetalle)}
        onOpenChange={(abierto) => {
          if (!abierto) setDivisionDetalleId(null)
        }}
        division={divisionDetalle ?? null}
        nivelNombre={nivel.nombre}
        anioNumero={anioDetalle?.numero ?? 0}
        puedeEditar={puedeEditar}
        // Cerrar el detalle antes de abrir el ABM evita apilar dos diálogos con foco atrapado;
        // al guardar, la recarga de la página actualiza los datos de la tarjeta.
        onAgregarMateriaCurso={(division) => {
          setDivisionDetalleId(null)
          props.onAgregarMateriaCurso(division)
        }}
        onEditarMateriaCurso={(materiaCurso) => {
          setDivisionDetalleId(null)
          props.onEditarMateriaCurso(materiaCurso)
        }}
        onEliminarMateriaCurso={(materiaCurso) => {
          setDivisionDetalleId(null)
          props.onEliminarMateriaCurso(materiaCurso)
        }}
      />
    </div>
  )
}

function AnioGrupo({
  anio,
  puedeEditar,
  onEditarAnio,
  onEliminarAnio,
  onAgregarDivision,
  onEditarDivision,
  onEliminarDivision,
  onAgregarMateriaCurso,
  onAbrirDetalle,
}: {
  anio: AnioConDivisiones
  puedeEditar: boolean
  onEditarAnio: (anio: Anio) => void
  onEliminarAnio: (anio: Anio) => void
  onAgregarDivision: (anioId: string) => void
  onEditarDivision: (division: Division) => void
  onEliminarDivision: (division: Division) => void
  onAgregarMateriaCurso: (division: DivisionConMaterias) => void
  onAbrirDetalle: (division: DivisionConMaterias) => void
}) {
  return (
    <div className="rounded-card bg-superficie p-5 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-texto">{anio.numero}°</span>
          <span className="text-xs text-texto-3">
            {pluralizar(anio.cantidad_divisiones, 'división', 'divisiones')} ·{' '}
            {pluralizar(anio.cantidad_materias, 'materia', 'materias')}
          </span>
        </div>
        {puedeEditar && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => onAgregarDivision(anio.id)}>
              <PlusIcon className="size-3.5" />
              División
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Acciones del año">
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onEditarAnio(anio)}>
                  <PencilIcon className="text-petroleo" />
                  Editar año
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => onEliminarAnio(anio)}>
                  <Trash2Icon />
                  Dar de baja
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {anio.divisiones.length === 0 ? (
        <div className="rounded-lg border border-dashed border-borde p-4 text-center text-sm text-texto-3">
          {puedeEditar ? (
            <>
              Sin divisiones.{' '}
              <button
                className="font-semibold text-violeta hover:underline"
                onClick={() => onAgregarDivision(anio.id)}
              >
                Agregar división
              </button>
            </>
          ) : (
            'Sin divisiones.'
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {anio.divisiones.map((division) => (
            <DivisionCard
              key={division.id}
              division={division}
              puedeEditar={puedeEditar}
              onAbrirDetalle={() => onAbrirDetalle(division)}
              onEditar={() => onEditarDivision(division)}
              onEliminar={() => onEliminarDivision(division)}
              onAgregarMateriaCurso={() => onAgregarMateriaCurso(division)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function DivisionCard({
  division,
  puedeEditar,
  onAbrirDetalle,
  onEditar,
  onEliminar,
  onAgregarMateriaCurso,
}: {
  division: DivisionConMaterias
  puedeEditar: boolean
  onAbrirDetalle: () => void
  onEditar: () => void
  onEliminar: () => void
  onAgregarMateriaCurso: () => void
}) {
  return (
    <div className="group relative rounded-card-sm border border-borde border-l-3 border-l-info bg-superficie shadow-card transition-colors hover:bg-fila-hover/40">
      <button
        type="button"
        onClick={onAbrirDetalle}
        aria-label={`Ver detalle del curso ${division.nombre}`}
        className="block w-full cursor-pointer rounded-card-sm p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violeta"
      >
        <div className={puedeEditar ? 'pr-9' : undefined}>
          <p className="text-base font-semibold text-texto">{division.nombre}</p>
          <p className="mt-0.5 text-xs text-texto-2">
            {pluralizar(division.materias.length, 'materia', 'materias')} ·{' '}
            {pluralizar(division.cantidad_inscripciones, 'alumno', 'alumnos')}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 text-xs font-semibold text-violeta">
          <span>Ver horarios y docentes</span>
          <ChevronRightIcon
            className="size-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </div>
      </button>

      {puedeEditar && (
        <div className="absolute top-2 right-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Acciones de la división">
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onAgregarMateriaCurso}>
                <PlusIcon className="text-petroleo" />
                Agregar materia
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onEditar}>
                <PencilIcon className="text-petroleo" />
                Editar división
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onEliminar}>
                <Trash2Icon />
                Dar de baja
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  )
}
