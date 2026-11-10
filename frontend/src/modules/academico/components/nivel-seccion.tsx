import { BookOpenIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { NivelConEstructura } from '@/modules/academico/hooks/use-estructura-academica'
import type { Anio, Division, MateriaCurso } from '@/modules/academico/types'
import { formatearHorarios } from '@/modules/academico/utils'

/** División tal como viene en el árbol, con sus materias-curso cargadas. */
type DivisionConMaterias = NivelConEstructura['anios'][number]['divisiones'][number]

interface NivelSeccionProps {
  nivel: NivelConEstructura
  /** Sin esto (ej. dirección, que solo mira la estructura), se ocultan todos los triggers de
   * escritura de esta sección y sus hijos — no solo se deshabilitan. */
  puedeEditar: boolean
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

function plural(cantidad: number, singular: string, pluralForma: string) {
  return `${cantidad} ${cantidad === 1 ? singular : pluralForma}`
}

export function NivelSeccion(props: NivelSeccionProps) {
  const { nivel, puedeEditar } = props
  const colorIdx = 0

  // Los conteos vienen del backend para no depender de lo que se haya cargado en el árbol.
  const totalDivisiones = nivel.anios.reduce((acc, a) => acc + a.cantidad_divisiones, 0)
  const totalMaterias = nivel.anios.reduce((acc, a) => acc + a.cantidad_materias, 0)

  return (
    <div className="mb-7 last:mb-0">
      <div className="mb-3.5 flex items-center gap-3.5">
        <div
          className={`flex size-10.5 shrink-0 items-center justify-center rounded-xl ${COLORES_NIVEL[colorIdx].sup} ${COLORES_NIVEL[colorIdx].sat}`}
        >
          <BookOpenIcon className="size-5" />
        </div>
        <div className="flex-1">
          <p className={`text-sm.5 font-semibold ${COLORES_NIVEL[colorIdx].sat}`}>{nivel.nombre}</p>
          <p className={`text-xs ${COLORES_NIVEL[colorIdx].dark}`}>
            {plural(nivel.cantidad_anios, 'año', 'años')} ·{' '}
            {plural(totalDivisiones, 'división', 'divisiones')} ·{' '}
            {plural(totalMaterias, 'materia', 'materias')}
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
            <AnioGrupo key={anio.id} anio={anio} {...props} />
          ))}
        </div>
      )}
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
  onEditarMateriaCurso,
  onEliminarMateriaCurso,
}: NivelSeccionProps & { anio: NivelConEstructura['anios'][number] }) {
  return (
    <div className="rounded-card bg-superficie p-5 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-texto">{anio.numero}°</span>
          <span className="text-xs text-texto-3">
            {plural(anio.cantidad_divisiones, 'división', 'divisiones')} ·{' '}
            {plural(anio.cantidad_materias, 'materia', 'materias')}
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
              onEditar={() => onEditarDivision(division)}
              onEliminar={() => onEliminarDivision(division)}
              onAgregarMateriaCurso={() => onAgregarMateriaCurso(division)}
              onEditarMateriaCurso={onEditarMateriaCurso}
              onEliminarMateriaCurso={onEliminarMateriaCurso}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function MateriaFila({
  materiaCurso,
  puedeEditar,
  onEditar,
  onEliminar,
}: {
  materiaCurso: MateriaCurso
  puedeEditar: boolean
  onEditar: (materiaCurso: MateriaCurso) => void
  onEliminar: (materiaCurso: MateriaCurso) => void
}) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-md px-2 py-1 text-xs hover:bg-fila-hover">
      <span className="flex flex-wrap items-center gap-1.5 text-texto">
        {materiaCurso.materia_tipo === 'taller' ? (
          <span className="rounded bg-sup-workflows px-1.5 py-0.5 text-xs font-semibold text-violeta">
            Taller
          </span>
        ) : (
          <span className="rounded bg-sup-academico px-1.5 py-0.5 text-xs font-semibold text-info">
            Materia
          </span>
        )}
        {materiaCurso.materia_nombre ?? '—'}
        <span className="text-texto-3">· {formatearHorarios(materiaCurso.horarios)}</span>
        {materiaCurso.cantidad_asignaciones === 0 && (
          <span className="text-texto-3">· sin docente</span>
        )}
      </span>
      {puedeEditar && (
        <div className="flex items-center gap-0.5">
          <button
            className="rounded p-1 text-texto-3 hover:bg-superficie hover:text-texto"
            onClick={() => onEditar(materiaCurso)}
            aria-label="Editar materia"
          >
            <PencilIcon className="size-3" />
          </button>
          <button
            className="rounded p-1 text-texto-3 hover:bg-superficie hover:text-error"
            onClick={() => onEliminar(materiaCurso)}
            aria-label="Eliminar materia"
          >
            <Trash2Icon className="size-3" />
          </button>
        </div>
      )}
    </div>
  )
}

function DivisionCard({
  division,
  puedeEditar,
  onEditar,
  onEliminar,
  onAgregarMateriaCurso,
  onEditarMateriaCurso,
  onEliminarMateriaCurso,
}: {
  division: NivelConEstructura['anios'][number]['divisiones'][number]
  puedeEditar: boolean
  onEditar: () => void
  onEliminar: () => void
  onAgregarMateriaCurso: () => void
  onEditarMateriaCurso: (materiaCurso: MateriaCurso) => void
  onEliminarMateriaCurso: (materiaCurso: MateriaCurso) => void
}) {
  return (
    <div className="rounded-card-sm border-l-3 border-l-info bg-superficie p-4 shadow-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-base font-semibold text-texto">{division.nombre}</p>
          <p className="mt-0.5 text-xs text-texto-2">
            {plural(division.materias.length, 'materia', 'materias')} ·{' '}
            {plural(division.cantidad_inscripciones, 'alumno', 'alumnos')}
          </p>
        </div>
        {puedeEditar && (
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
        )}
      </div>

      {division.materias.length > 0 ? (
        <div className="mt-3 flex flex-col gap-1">
          {division.materias.map((materiaCurso) => (
            <MateriaFila
              key={materiaCurso.id}
              materiaCurso={materiaCurso}
              puedeEditar={puedeEditar}
              onEditar={onEditarMateriaCurso}
              onEliminar={onEliminarMateriaCurso}
            />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-texto-3">Sin materias asignadas.</p>
      )}
    </div>
  )
}
