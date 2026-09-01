import {
  MoreHorizontalIcon,
  PlusIcon,
  SearchIcon,
  ShieldAlertIcon,
  Trash2Icon,
  UsersIcon,
  GraduationCapIcon,
  BuildingIcon,
  AlertTriangleIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { PageHeader } from '@/components/page-header'
import { FilterBar, FilterBarSpacer } from '@/components/filter-bar'
import { FilterDropdown, type FilterDropdownOption } from '@/components/filter-dropdown'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAsignacionesDocentes } from '@/modules/academico/hooks/use-asignaciones-docentes'
import { AsignacionDialog } from '@/modules/academico/components/asignacion-dialog'
import type { AsignacionDocente } from '@/modules/academico/types'

type DialogState =
  { open: false } | { open: true; modo: 'crear' | 'eliminar'; item?: AsignacionDocente }

export function AsignacionesDocentesPage() {
  const { asignaciones, docentes, materias, divisiones, cargando, error, sinPermiso, recargar } =
    useAsignacionesDocentes()
  const [busqueda, setBusqueda] = useState('')
  const [filtroCiclo, setFiltroCiclo] = useState('todos')
  const [filtroDivision, setFiltroDivision] = useState<string[]>([])
  const [dialog, setDialog] = useState<DialogState>({ open: false })

  const cicloActual = String(new Date().getFullYear())

  const ciclosDisponibles = useMemo(() => {
    const ciclos = new Set(asignaciones.map((a) => a.ciclo_lectivo))
    return Array.from(ciclos).sort().reverse()
  }, [asignaciones])

  const cicloOptions: FilterDropdownOption[] = useMemo(
    () => [
      { value: 'todos', label: 'Todos' },
      ...ciclosDisponibles.map((c) => ({ value: c, label: c })),
    ],
    [ciclosDisponibles],
  )

  const divisionOptions: FilterDropdownOption[] = useMemo(
    () => divisiones.map((d) => ({ value: d.id, label: d.nombre })),
    [divisiones],
  )

  const asignacionesFiltradas = useMemo(() => {
    let result = asignaciones
    if (filtroCiclo !== 'todos') {
      result = result.filter((a) => a.ciclo_lectivo === filtroCiclo)
    }
    if (filtroDivision.length > 0) {
      result = result.filter((a) => filtroDivision.includes(a.division_id))
    }
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      result = result.filter(
        (a) =>
          a.docente_nombre.toLowerCase().includes(q) || a.materia_nombre.toLowerCase().includes(q),
      )
    }
    return result
  }, [asignaciones, filtroCiclo, filtroDivision, busqueda])

  const stats = useMemo(() => {
    const docentesActivos = new Set(asignaciones.map((a) => a.docente_id))
    const divisionesCubiertas = new Set(asignaciones.map((a) => a.division_id))
    return {
      activas: asignaciones.length,
      docentes: docentesActivos.size,
      divisiones: divisionesCubiertas.size,
    }
  }, [asignaciones])

  if (sinPermiso) {
    return (
      <Empty className="min-h-[420px] rounded-panel bg-superficie shadow-card">
        <EmptyMedia variant="neutral">
          <ShieldAlertIcon />
        </EmptyMedia>
        <EmptyTitle>No tenés permiso para ver las asignaciones docentes.</EmptyTitle>
        <EmptyDescription>
          Solicitá acceso al módulo Académico a una persona administradora.
        </EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Asignaciones docentes"
        accion={
          <Button onClick={() => setDialog({ open: true, modo: 'crear' })}>
            <PlusIcon />
            Nueva asignación
          </Button>
        }
      />

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-panel bg-banda-oscura p-5 text-texto-sobre-oscuro shadow-card">
          <div className="flex items-start justify-between gap-2.5">
            <p className="text-xs font-semibold text-texto-2-sobre-oscuro">Asignaciones activas</p>
            <div className="flex size-7.5 items-center justify-center rounded-lg bg-white/15">
              <UsersIcon className="size-4" />
            </div>
          </div>
          <p className="mt-2.5 text-2xl font-semibold tabular-nums">{stats.activas}</p>
        </div>
        <div className="rounded-panel bg-superficie p-5 shadow-card">
          <div className="flex items-start justify-between gap-2.5">
            <p className="text-xs font-semibold text-texto-2">Docentes con asignación</p>
            <div className="flex size-7.5 items-center justify-center rounded-lg bg-info-suave text-info">
              <GraduationCapIcon className="size-4" />
            </div>
          </div>
          <p className="mt-2.5 text-2xl font-semibold tabular-nums text-texto">{stats.docentes}</p>
        </div>
        <div className="rounded-panel bg-superficie p-5 shadow-card">
          <div className="flex items-start justify-between gap-2.5">
            <p className="text-xs font-semibold text-texto-2">Divisiones cubiertas</p>
            <div className="flex size-7.5 items-center justify-center rounded-lg bg-info-suave text-info">
              <BuildingIcon className="size-4" />
            </div>
          </div>
          <p className="mt-2.5 text-2xl font-semibold tabular-nums text-texto">
            {stats.divisiones}
          </p>
        </div>
        <div className="rounded-panel bg-superficie p-5 shadow-card">
          <div className="flex items-start justify-between gap-2.5">
            <p className="text-xs font-semibold text-texto-2">Materias sin docente</p>
            <div className="flex size-7.5 items-center justify-center rounded-lg bg-error-suave text-error">
              <AlertTriangleIcon className="size-4" />
            </div>
          </div>
          <p className="mt-2.5 text-2xl font-semibold tabular-nums text-texto">—</p>
        </div>
      </div>

      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudieron cargar las asignaciones</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {error}
            <Button variant="secondary" size="sm" onClick={recargar}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {asignaciones.length > 0 && (
        <FilterBar>
          <div className="relative flex h-10 min-w-[200px] items-center gap-2 rounded-full border border-borde bg-superficie pl-3.5 pr-3 text-sm text-texto-2">
            <SearchIcon className="size-4 text-texto-3" />
            <input
              type="text"
              placeholder="Buscar docente o materia"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full bg-transparent text-texto outline-none placeholder:text-texto-3"
            />
          </div>
          {ciclosDisponibles.length > 0 && (
            <FilterDropdown
              label="Ciclo lectivo"
              options={cicloOptions}
              value={filtroCiclo}
              onChange={setFiltroCiclo}
              active={filtroCiclo !== 'todos'}
            />
          )}
          {divisionOptions.length > 0 && (
            <FilterDropdown
              label="División"
              options={divisionOptions}
              multiple
              value={filtroDivision}
              onChange={setFiltroDivision}
            />
          )}
          <FilterBarSpacer />
        </FilterBar>
      )}

      {cargando ? (
        <div className="rounded-panel bg-superficie p-6 shadow-card">
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-11 animate-pulse rounded bg-fila-hover" />
            ))}
          </div>
        </div>
      ) : asignaciones.length === 0 ? (
        <Empty className="min-h-[280px] rounded-panel bg-superficie shadow-card">
          <EmptyMedia variant="icon" className="bg-sup-academico text-info">
            <UsersIcon />
          </EmptyMedia>
          <EmptyTitle>Todavía no hay asignaciones docentes.</EmptyTitle>
          <EmptyDescription>
            Asigná docentes a materias y divisiones para el ciclo lectivo actual.
          </EmptyDescription>
          <Button onClick={() => setDialog({ open: true, modo: 'crear' })}>
            <PlusIcon />
            Nueva asignación
          </Button>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Docente</TableHead>
              <TableHead>Materia</TableHead>
              <TableHead>División</TableHead>
              <TableHead>Ciclo</TableHead>
              <TableHead data-align="end" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {asignacionesFiltradas.map((asignacion) => (
              <TableRow key={asignacion.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-6.5 shrink-0 items-center justify-center rounded-full bg-violeta text-xs font-semibold text-white">
                      {asignacion.docente_nombre.slice(0, 2).toUpperCase()}
                    </div>
                    {asignacion.docente_nombre}
                  </div>
                </TableCell>
                <TableCell>{asignacion.materia_nombre}</TableCell>
                <TableCell>{asignacion.division_nombre}</TableCell>
                <TableCell className="tabular-nums">{asignacion.ciclo_lectivo}</TableCell>
                <TableCell data-align="end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Acciones de la asignación">
                        <MoreHorizontalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() =>
                          setDialog({ open: true, modo: 'eliminar', item: asignacion })
                        }
                      >
                        <Trash2Icon />
                        Quitar asignación
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {dialog.open && (
        <AsignacionDialog
          open={dialog.open}
          onOpenChange={(open) => !open && setDialog({ open: false })}
          modo={dialog.modo}
          item={dialog.item}
          docentes={docentes}
          materias={materias}
          divisiones={divisiones}
          cicloActual={cicloActual}
          onExito={recargar}
        />
      )}
    </div>
  )
}
