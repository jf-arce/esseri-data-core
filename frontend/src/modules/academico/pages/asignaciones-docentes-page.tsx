import {
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  ShieldAlertIcon,
  Trash2Icon,
  UsersIcon,
  GraduationCapIcon,
  BuildingIcon,
  AlertTriangleIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { normalizarTexto } from '@/lib/texto'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { BackLink } from '@/components/back-link'
import { Button } from '@/components/ui/button'
import { useAbrirDesdeUrl } from '@/hooks/use-abrir-desde-url'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { PageHeader } from '@/components/page-header'
import { StatTile } from '@/components/stat-tile'
import { FilterBar, FilterBarSpacer, FilterSearch } from '@/components/filter-bar'
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
import { useMateriasSinDocente } from '@/modules/academico/hooks/use-materias-sin-docente'
import { useAsignacionesDocentes } from '@/modules/academico/hooks/use-asignaciones-docentes'
import { AsignacionDialog } from '@/modules/academico/components/asignacion-dialog'
import type { AsignacionDocente } from '@/modules/academico/types'
import { formatearHorarios } from '@/modules/academico/utils'
import { PERMISO_ACADEMICO_ACTUALIZAR, tienePermiso } from '@/modules/auth/constants'
import { permisosActivos, useAuthStore } from '@/store/auth-store'

type DialogState =
  { open: false } | { open: true; modo: 'crear' | 'editar' | 'eliminar'; item?: AsignacionDocente }

export function AsignacionesDocentesPage() {
  const {
    asignaciones,
    docentes,
    materiasCurso,
    divisiones,
    cargando,
    error,
    sinPermiso,
    recargar,
  } = useAsignacionesDocentes()
  // Entrar acá solo pide `academico.leer` (ver routes.tsx); crear/quitar una asignación sigue
  // pidiendo el `actualizar` de escritura — mismo patrón que `estructura-academica-page.tsx`.
  const permisos = useAuthStore(permisosActivos)
  const puedeEditar = tienePermiso(permisos, PERMISO_ACADEMICO_ACTUALIZAR)
  const [busqueda, setBusqueda] = useState('')
  const [filtroCiclo, setFiltroCiclo] = useState('todos')
  const [filtroDivision, setFiltroDivision] = useState<string[]>([])
  const [dialog, setDialog] = useState<DialogState>({ open: false })
  // El buscador global linkea con `?crear=1` para abrir el alta directo.
  useAbrirDesdeUrl('crear', () => setDialog({ open: true, modo: 'crear' }), puedeEditar)

  const cicloActual = String(new Date().getFullYear())
  const sinDocente = useMateriasSinDocente(cicloActual)
  function recargarTodo() {
    recargar()
    sinDocente.recargar()
  }

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
      result = result.filter((a) => filtroDivision.includes(a.division_id ?? ''))
    }
    if (busqueda.trim()) {
      const q = normalizarTexto(busqueda)
      result = result.filter(
        (a) =>
          normalizarTexto(a.docente_nombre).includes(q) ||
          normalizarTexto(a.materia_nombre).includes(q),
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
      materiasSinDocente: sinDocente.materias.length,
    }
  }, [asignaciones, sinDocente.materias])

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
      <BackLink to="/academico" label="Volver a Académico" />
      <PageHeader
        titulo="Asignaciones docentes"
        accion={
          puedeEditar && (
            <Button onClick={() => setDialog({ open: true, modo: 'crear' })}>
              <PlusIcon />
              Nueva asignación
            </Button>
          )
        }
      />

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-4 @3xl/main:grid-cols-4">
        <StatTile label="Asignaciones activas" value={stats.activas} icon={UsersIcon} />
        <StatTile
          label="Docentes con asignación"
          value={stats.docentes}
          icon={GraduationCapIcon}
          iconClassName="bg-info-suave text-info"
        />
        <StatTile
          label="Divisiones cubiertas"
          value={stats.divisiones}
          icon={BuildingIcon}
          iconClassName="bg-info-suave text-info"
        />
        <StatTile
          label="Materias sin docente"
          value={stats.materiasSinDocente}
          icon={AlertTriangleIcon}
          iconClassName="bg-error-suave text-error"
        />
      </div>

      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudieron cargar las asignaciones</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            {error}
            <Button variant="secondary" size="sm" onClick={recargarTodo}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {asignaciones.length > 0 && (
        <FilterBar>
          <FilterSearch
            value={busqueda}
            onChange={setBusqueda}
            placeholder="Buscar docente o materia"
          />
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
            {puedeEditar
              ? 'Asigná docentes a materias y divisiones para el ciclo lectivo actual.'
              : 'Todavía no se cargó ninguna asignación para el ciclo lectivo actual.'}
          </EmptyDescription>
          {puedeEditar && (
            <Button onClick={() => setDialog({ open: true, modo: 'crear' })}>
              <PlusIcon />
              Nueva asignación
            </Button>
          )}
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Docente</TableHead>
              <TableHead>Materia</TableHead>
              <TableHead>División</TableHead>
              <TableHead>Horario</TableHead>
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
                <TableCell className="max-w-64 min-w-48 text-xs whitespace-normal text-texto-2">
                  {formatearHorarios(asignacion.horarios)}
                </TableCell>
                <TableCell className="tabular-nums">{asignacion.ciclo_lectivo}</TableCell>
                <TableCell data-align="end">
                  {puedeEditar && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Acciones de la asignación"
                        >
                          <MoreHorizontalIcon />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() =>
                            setDialog({ open: true, modo: 'editar', item: asignacion })
                          }
                        >
                          <PencilIcon />
                          Editar asignación
                        </DropdownMenuItem>
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
                  )}
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
          materiasCurso={materiasCurso}
          divisiones={divisiones}
          cicloActual={cicloActual}
          onExito={recargarTodo}
        />
      )}
    </div>
  )
}
