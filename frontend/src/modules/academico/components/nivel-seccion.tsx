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
import type { Anio, Division, Materia, NivelEducativo } from '@/modules/academico/types'

interface NivelSeccionProps {
  nivel: NivelConEstructura
  onEditarNivel: (nivel: NivelEducativo) => void
  onEliminarNivel: (nivel: NivelEducativo) => void
  onAgregarAnio: (nivelId: string) => void
  onEditarAnio: (anio: Anio) => void
  onEliminarAnio: (anio: Anio) => void
  onAgregarDivision: (anioId: string) => void
  onEditarDivision: (division: Division) => void
  onEliminarDivision: (division: Division) => void
  onAgregarMateria: (anioId: string) => void
  onEditarMateria: (materia: Materia) => void
  onEliminarMateria: (materia: Materia) => void
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
  const { nivel } = props
  const colorIdx = 0

  const totalDivisiones = nivel.anios.reduce((acc, a) => acc + a.divisiones.length, 0)
  const totalMaterias = nivel.anios.reduce(
    (acc, a) => acc + a.divisiones.reduce((acc2, d) => acc2 + d.materias.length, 0),
    0,
  )

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
            {totalDivisiones} {totalDivisiones === 1 ? 'división' : 'divisiones'} · {totalMaterias}{' '}
            {totalMaterias === 1 ? 'materia' : 'materias'}
          </p>
        </div>
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
      </div>

      {nivel.anios.length === 0 ? (
        <div className="rounded-card bg-superficie p-6 text-center text-sm text-texto-3 shadow-card">
          No hay años cargados en este nivel.{' '}
          <button
            className="font-semibold text-violeta hover:underline"
            onClick={() => props.onAgregarAnio(nivel.id)}
          >
            Agregar el primer año
          </button>
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
  onEditarAnio,
  onEliminarAnio,
  onAgregarDivision,
  onEditarDivision,
  onEliminarDivision,
  onAgregarMateria,
  onEditarMateria,
  onEliminarMateria,
}: NivelSeccionProps & { anio: NivelConEstructura['anios'][number] }) {
  return (
    <div className="rounded-card bg-superficie p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-texto">{anio.numero}°</span>
          <span className="text-xs text-texto-3">
            {anio.divisiones.length} {anio.divisiones.length === 1 ? 'división' : 'divisiones'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => onAgregarDivision(anio.id)}>
            <PlusIcon className="size-3.5" />
            División
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onAgregarMateria(anio.id)}>
            <PlusIcon className="size-3.5" />
            Materia
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
      </div>

      {anio.divisiones.length === 0 ? (
        <div className="rounded-lg border border-dashed border-borde p-4 text-center text-sm text-texto-3">
          Sin divisiones.{' '}
          <button
            className="font-semibold text-violeta hover:underline"
            onClick={() => onAgregarDivision(anio.id)}
          >
            Agregar división
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {anio.divisiones.map((division) => (
            <DivisionCard
              key={division.id}
              division={division}
              onEditar={() => onEditarDivision(division)}
              onEliminar={() => onEliminarDivision(division)}
              onEditarMateria={onEditarMateria}
              onEliminarMateria={onEliminarMateria}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function DivisionCard({
  division,
  onEditar,
  onEliminar,
  onEditarMateria,
  onEliminarMateria,
}: {
  division: NivelConEstructura['anios'][number]['divisiones'][number]
  onEditar: () => void
  onEliminar: () => void
  onEditarMateria: (materia: Materia) => void
  onEliminarMateria: (materia: Materia) => void
}) {
  return (
    <div className="rounded-card-sm border-l-3 border-l-info bg-superficie p-4 shadow-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-base font-semibold text-texto">{division.nombre}</p>
          <p className="mt-0.5 text-xs text-texto-2">
            {division.materias.length} {division.materias.length === 1 ? 'materia' : 'materias'}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Acciones de la división">
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
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

      {division.materias.length > 0 && (
        <div className="mt-3 flex flex-col gap-1">
          {division.materias.map((materia) => (
            <div
              key={materia.id}
              className="flex items-center justify-between rounded-md px-2 py-1 text-xs hover:bg-fila-hover"
            >
              <span className="flex items-center gap-1.5 text-texto">
                {materia.tipo === 'taller' ? (
                  <span className="rounded bg-sup-workflows px-1.5 py-0.5 text-[10px] font-semibold text-violeta">
                    Taller
                  </span>
                ) : (
                  <span className="rounded bg-sup-academico px-1.5 py-0.5 text-[10px] font-semibold text-info">
                    Materia
                  </span>
                )}
                {materia.nombre}
                {materia.division_id === null && <span className="text-texto-3">(común)</span>}
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  className="rounded p-1 text-texto-3 hover:bg-superficie hover:text-texto"
                  onClick={() => onEditarMateria(materia)}
                  aria-label="Editar materia"
                >
                  <PencilIcon className="size-3" />
                </button>
                <button
                  className="rounded p-1 text-texto-3 hover:bg-superficie hover:text-error"
                  onClick={() => onEliminarMateria(materia)}
                  aria-label="Eliminar materia"
                >
                  <Trash2Icon className="size-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
