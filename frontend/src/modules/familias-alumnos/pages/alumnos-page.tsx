import {
  EyeIcon,
  GraduationCapIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  ShieldAlertIcon,
  Trash2Icon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { PageHeader } from '@/components/page-header'
import { StatTile } from '@/components/stat-tile'
import { FilterBar, FilterBarSpacer, FilterSearch, DensityToggle } from '@/components/filter-bar'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmarEliminacion } from '@/components/confirmar-eliminacion'
import { useAlumnos } from '../hooks/use-alumnos'
import { eliminarAlumno } from '../services/eliminar-alumno'
import type { Alumno, EstadoAlumno } from '../types'

const ESTADO_OPTIONS: FilterDropdownOption[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'activo', label: 'Activo' },
  { value: 'inactivo', label: 'Inactivo' },
  { value: 'egresado', label: 'Egresado' },
]

const ORDEN_OPTIONS: FilterDropdownOption[] = [
  { value: 'recientes', label: 'Más recientes' },
  { value: 'antiguas', label: 'Más antiguas' },
  { value: 'legajo', label: 'Por legajo' },
]

function BadgeEstado({ estado }: { estado: EstadoAlumno }) {
  if (estado === 'activo') return <Badge variant="exito">Activo</Badge>
  if (estado === 'inactivo') return <Badge variant="neutro">Inactivo</Badge>
  return <Badge variant="info">Egresado</Badge>
}

export function AlumnosPage() {
  const { datos: alumnos, cargando, error, sinPermiso, recargar } = useAlumnos()
  const navigate = useNavigate()
  const [alumnoAEliminar, setAlumnoAEliminar] = useState<Alumno | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('todos')
  const [orden, setOrden] = useState('recientes')
  const [densidad, setDensidad] = useState<'comfortable' | 'compact'>('comfortable')

  const stats = useMemo(() => {
    const total = alumnos.length
    const activos = alumnos.filter((a) => a.estado === 'activo').length
    const inactivos = alumnos.filter((a) => a.estado === 'inactivo').length
    const egresados = alumnos.filter((a) => a.estado === 'egresado').length
    return { total, activos, inactivos, egresados }
  }, [alumnos])

  const filtrados = useMemo(() => {
    let resultado = alumnos
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      resultado = resultado.filter(
        (a) =>
          a.numero_legajo.toLowerCase().includes(q) ||
          a.persona_nombre.toLowerCase().includes(q) ||
          a.persona_apellido.toLowerCase().includes(q) ||
          a.persona_dni.toLowerCase().includes(q),
      )
    }
    if (estado !== 'todos') {
      resultado = resultado.filter((a) => a.estado === estado)
    }
    const ordenados = [...resultado]
    if (orden === 'recientes') {
      ordenados.sort((a, b) => b.created_at.localeCompare(a.created_at))
    } else if (orden === 'antiguas') {
      ordenados.sort((a, b) => a.created_at.localeCompare(b.created_at))
    } else if (orden === 'legajo') {
      ordenados.sort((a, b) => a.numero_legajo.localeCompare(b.numero_legajo))
    }
    return ordenados
  }, [alumnos, busqueda, estado, orden])

  if (sinPermiso) {
    return (
      <Empty className="rounded-panel bg-superficie shadow-card min-h-[420px]">
        <EmptyMedia variant="neutral">
          <ShieldAlertIcon />
        </EmptyMedia>
        <EmptyTitle>No tenés permiso para ver los alumnos.</EmptyTitle>
        <EmptyDescription>
          Solicitá acceso al módulo de Familias y alumnos a una persona administradora.
        </EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Alumnos"
        accion={
          <Button onClick={() => navigate('/familias-alumnos/alumnos/nuevo')}>
            <PlusIcon />
            Dar de alta alumno
          </Button>
        }
      />

      <div className="grid grid-cols-4 gap-4">
        <StatTile
          label="Alumnos registrados"
          value={stats.total}
          icon={GraduationCapIcon}
          variant="dark"
          cargando={cargando}
        />
        <StatTile
          label="Activos"
          value={stats.activos}
          icon={GraduationCapIcon}
          iconClassName="bg-exito-suave text-exito"
          cargando={cargando}
        />
        <StatTile
          label="Inactivos"
          value={stats.inactivos}
          icon={GraduationCapIcon}
          iconClassName="bg-fila-hover text-texto-3"
          cargando={cargando}
        />
        <StatTile
          label="Egresados"
          value={stats.egresados}
          icon={GraduationCapIcon}
          iconClassName="bg-info-suave text-info"
          cargando={cargando}
        />
      </div>

      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudieron cargar los alumnos</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {error}
            <Button variant="secondary" size="sm" onClick={recargar}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <FilterBar>
        <FilterSearch value={busqueda} onChange={setBusqueda} placeholder="Buscar por legajo" />
        <FilterDropdown
          label="Estado"
          options={ESTADO_OPTIONS}
          value={estado}
          onChange={setEstado}
          active={estado !== 'todos'}
        />
        <FilterBarSpacer />
        <FilterDropdown
          label="Ordenar por"
          options={ORDEN_OPTIONS}
          value={orden}
          onChange={setOrden}
          align="end"
        />
        <DensityToggle value={densidad} onChange={setDensidad} />
      </FilterBar>

      {!cargando && filtrados.length === 0 ? (
        <Empty className="rounded-panel bg-superficie shadow-card min-h-[280px]">
          <EmptyMedia variant="icon" className="bg-violeta-suave text-violeta">
            <GraduationCapIcon />
          </EmptyMedia>
          <EmptyTitle>
            {alumnos.length === 0
              ? 'Todavía no hay alumnos cargados.'
              : 'Ningún alumno coincide con estos filtros.'}
          </EmptyTitle>
          {alumnos.length === 0 ? (
            <>
              <EmptyDescription>
                Acción sugerida: dar de alta el primer alumno para poder vincularlo a una familia.
              </EmptyDescription>
              <Button onClick={() => navigate('/familias-alumnos/alumnos/nuevo')}>
                <PlusIcon />
                Dar de alta alumno
              </Button>
            </>
          ) : (
            <EmptyDescription>
              Probá ajustar la búsqueda o limpiar los filtros activos.
            </EmptyDescription>
          )}
        </Empty>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table data-density={densidad === 'compact' ? 'compact' : undefined}>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Legajo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha de alta</TableHead>
                <TableHead data-align="end">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargando ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-texto-2">
                    Cargando alumnos…
                  </TableCell>
                </TableRow>
              ) : (
                filtrados.map((alumno) => (
                  <TableRow
                    key={alumno.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/familias-alumnos/alumnos/${alumno.id}`)}
                  >
                    <TableCell className="font-medium text-texto">
                      {alumno.persona_nombre} {alumno.persona_apellido}
                    </TableCell>
                    <TableCell className="font-mono font-medium">{alumno.numero_legajo}</TableCell>
                    <TableCell>
                      <BadgeEstado estado={alumno.estado} />
                    </TableCell>
                    <TableCell className="text-texto-2">
                      {new Date(alumno.created_at).toLocaleDateString('es-AR')}
                    </TableCell>
                    <TableCell data-align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label="Acciones">
                            <MoreHorizontalIcon />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => navigate(`/familias-alumnos/alumnos/${alumno.id}`)}
                          >
                            <EyeIcon className="text-petroleo" />
                            Ver ficha
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() =>
                              navigate(`/familias-alumnos/alumnos/${alumno.id}/editar`)
                            }
                          >
                            <PencilIcon className="text-petroleo" />
                            Editar datos
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setAlumnoAEliminar(alumno)}
                          >
                            <Trash2Icon />
                            Dar de baja
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {alumnoAEliminar && (
        <ConfirmarEliminacion
          open={!!alumnoAEliminar}
          onOpenChange={(open) => !open && setAlumnoAEliminar(null)}
          titulo="Dar de baja alumno"
          descripcion={`Esta acción no se puede deshacer. Si el alumno "${alumnoAEliminar.numero_legajo}" tiene familias vinculadas, el sistema no va a permitir borrarlo.`}
          onConfirmar={async () => {
            await eliminarAlumno(alumnoAEliminar.id)
            recargar()
          }}
        />
      )}
    </div>
  )
}
