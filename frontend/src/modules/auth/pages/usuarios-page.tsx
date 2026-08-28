import {
  ArrowDownAZIcon,
  MoreHorizontalIcon,
  PencilIcon,
  SearchIcon,
  UserCheckIcon,
  UsersRoundIcon,
  UserXIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { FilterChip, FilterChips, FilterDropdown } from '@/components/filter-dropdown'
import {
  Pagination,
  PaginationContent,
  PaginationCount,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import { StatTile } from '@/components/stat-tile'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { SeccionHeader } from '@/modules/auth/pages/configuracion-acceso-page'
import { UsuarioDetalleDialog } from '@/modules/auth/components/usuario-detalle-dialog'
import { UsuarioRolesDialog } from '@/modules/auth/components/usuario-roles-dialog'
import { useRoles } from '@/modules/auth/hooks/use-roles'
import { useUsuarios } from '@/modules/auth/hooks/use-usuarios'
import type { UsuarioConRoles } from '@/modules/auth/types'
import {
  colorIdentidad,
  filtrarYOrdenarUsuarios,
  formatearFechaHora,
  inicialesDeUsuario,
  nombreDeUsuario,
  type EstadoUsuarioFiltro,
  type OrdenUsuarios,
} from '@/modules/auth/utils'

const PAGE_SIZE = 10

const OPCIONES_ESTADO: { value: EstadoUsuarioFiltro; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'activo', label: 'Activos' },
  { value: 'inactivo', label: 'Inactivos' },
]

const OPCIONES_ORDEN: { value: OrdenUsuarios; label: string }[] = [
  { value: 'nombre-asc', label: 'Nombre, A-Z' },
  { value: 'nombre-desc', label: 'Nombre, Z-A' },
  { value: 'acceso-reciente', label: 'Último acceso reciente' },
  { value: 'acceso-antiguo', label: 'Último acceso antiguo' },
]

function RolChip({ nombre, id }: { nombre: string; id: string }) {
  const color = colorIdentidad(id)
  return (
    <span
      className="inline-flex h-[22px] shrink-0 items-center rounded-full px-2.5 text-xs font-semibold whitespace-nowrap"
      style={{ backgroundColor: `color-mix(in oklch, ${color} 12%, white)`, color }}
    >
      {nombre}
    </span>
  )
}

function FilaEsqueleto() {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-6 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-[22px] w-20 rounded-full" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-28" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-[22px] w-16 rounded-full" />
      </TableCell>
      <TableCell data-align="end">
        <Skeleton className="ml-auto size-8 rounded-full" />
      </TableCell>
    </TableRow>
  )
}

export function UsuariosPage() {
  const { datos: usuarios, cargando, error, recargar } = useUsuarios()
  const { datos: roles } = useRoles()

  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState<EstadoUsuarioFiltro>('todos')
  const [rolesFiltro, setRolesFiltro] = useState<string[]>([])
  const [orden, setOrden] = useState<OrdenUsuarios>('nombre-asc')
  const [densidad, setDensidad] = useState<'comfortable' | 'compact'>('comfortable')
  const [pagina, setPagina] = useState(0)

  const [usuarioDetalle, setUsuarioDetalle] = useState<UsuarioConRoles | null>(null)
  const [usuarioEditandoRoles, setUsuarioEditandoRoles] = useState<UsuarioConRoles | null>(null)

  const kpis = useMemo(() => {
    const activos = usuarios.filter((u) => u.estado === 'activo').length
    const inactivos = usuarios.filter((u) => u.estado !== 'activo').length
    const conMasDeUnRol = usuarios.filter((u) => u.roles.length > 1).length
    return { activos, inactivos, conMasDeUnRol }
  }, [usuarios])

  const filtrados = useMemo(
    () => filtrarYOrdenarUsuarios(usuarios, { busqueda, estado, roles: rolesFiltro, orden }),
    [usuarios, busqueda, estado, rolesFiltro, orden],
  )

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))
  const paginaActual = Math.min(pagina, totalPaginas - 1)
  const visibles = filtrados.slice(paginaActual * PAGE_SIZE, paginaActual * PAGE_SIZE + PAGE_SIZE)

  function actualizarFiltro<T>(setter: (valor: T) => void) {
    return (valor: T) => {
      setter(valor)
      setPagina(0)
    }
  }

  const hayFiltrosActivos = estado !== 'todos' || rolesFiltro.length > 0

  return (
    <div className="flex flex-col gap-4">
      <SeccionHeader titulo="Usuarios y roles" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Usuarios activos" value={kpis.activos} icon={UserCheckIcon} variant="dark" />
        <StatTile label="Con más de un rol" value={kpis.conMasDeUnRol} icon={UsersRoundIcon} />
        <StatTile label="Inactivos" value={kpis.inactivos} icon={UserXIcon} />
      </div>

      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudieron cargar los usuarios</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {error}
            <Button variant="secondary" size="sm" onClick={recargar}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex h-8 min-w-[200px] items-center rounded-full border border-borde bg-superficie pr-3 pl-8 text-xs text-texto-2">
          <SearchIcon className="absolute left-3 size-3.5 text-texto-3" />
          <input
            value={busqueda}
            onChange={(evento) => actualizarFiltro(setBusqueda)(evento.target.value)}
            placeholder="Buscar usuario"
            className="w-full bg-transparent outline-none placeholder:text-texto-3"
          />
        </div>

        <FilterDropdown
          label="Estado"
          options={OPCIONES_ESTADO}
          value={estado}
          onChange={(valor) => actualizarFiltro(setEstado)(valor as EstadoUsuarioFiltro)}
          active={estado !== 'todos'}
        />

        <FilterDropdown
          multiple
          label="Rol"
          options={roles.map((rol) => ({ value: rol.id, label: rol.nombre }))}
          value={rolesFiltro}
          onChange={actualizarFiltro(setRolesFiltro)}
        />

        <div className="flex-1" />

        <FilterDropdown
          label={OPCIONES_ORDEN.find((o) => o.value === orden)?.label ?? 'Ordenar por'}
          icon={ArrowDownAZIcon}
          align="end"
          options={OPCIONES_ORDEN}
          value={orden}
          onChange={(valor) => setOrden(valor as OrdenUsuarios)}
        />

        <ToggleGroup
          type="single"
          spacing={0}
          value={densidad}
          onValueChange={(valor) => valor && setDensidad(valor as 'comfortable' | 'compact')}
        >
          <ToggleGroupItem value="comfortable" variant="outline" size="sm" aria-label="Densidad cómoda">
            Cómoda
          </ToggleGroupItem>
          <ToggleGroupItem value="compact" variant="outline" size="sm" aria-label="Densidad compacta">
            Compacta
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {hayFiltrosActivos && (
        <FilterChips
          onClearAll={() => {
            actualizarFiltro(setEstado)('todos')
            actualizarFiltro(setRolesFiltro)([])
          }}
        >
          {estado !== 'todos' && (
            <FilterChip onRemove={() => actualizarFiltro(setEstado)('todos')}>
              Estado: {OPCIONES_ESTADO.find((o) => o.value === estado)?.label}
            </FilterChip>
          )}
          {rolesFiltro.map((rolId) => {
            const rol = roles.find((r) => r.id === rolId)
            if (!rol) return null
            return (
              <FilterChip
                key={rolId}
                onRemove={() => actualizarFiltro(setRolesFiltro)(rolesFiltro.filter((id) => id !== rolId))}
              >
                Rol: {rol.nombre}
              </FilterChip>
            )
          })}
        </FilterChips>
      )}

      {!cargando && filtrados.length === 0 ? (
        <Empty className="rounded-panel bg-superficie shadow-card">
          <EmptyMedia variant="icon" className="bg-violeta-suave text-violeta">
            <UsersRoundIcon />
          </EmptyMedia>
          <EmptyTitle>
            {usuarios.length === 0 ? 'Todavía no hay usuarios cargados.' : 'Ningún usuario coincide con estos filtros.'}
          </EmptyTitle>
          {usuarios.length > 0 && (
            <EmptyDescription>Probá ajustar la búsqueda o limpiar los filtros activos.</EmptyDescription>
          )}
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-panel bg-superficie shadow-card">
          <Table containerClassName="rounded-none shadow-none" data-density={densidad === 'compact' ? 'compact' : undefined}>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Último acceso</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead data-align="end">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargando ? (
                Array.from({ length: 6 }).map((_, i) => <FilaEsqueleto key={i} />)
              ) : (
                visibles.map((usuario) => (
                  <TableRow key={usuario.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar size="sm">
                          <AvatarFallback
                            style={{ backgroundColor: colorIdentidad(usuario.id), color: '#fff' }}
                          >
                            {inicialesDeUsuario(usuario.email)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{nombreDeUsuario(usuario.email)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {usuario.roles.length === 0 ? (
                          <span className="text-texto-3">Sin rol</span>
                        ) : (
                          usuario.roles.map((rol) => (
                            <RolChip key={rol.id} id={rol.id} nombre={rol.nombre} />
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatearFechaHora(usuario.ultimo_acceso)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={usuario.estado === 'activo' ? 'exito' : 'neutro'}>
                        {usuario.estado === 'activo' ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell data-align="end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Acciones para ${usuario.email}`}
                          >
                            <MoreHorizontalIcon />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setUsuarioDetalle(usuario)}>
                            Ver detalle
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setUsuarioEditandoRoles(usuario)}>
                            <PencilIcon />
                            Editar roles
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {!cargando && filtrados.length > 0 && (
            <Pagination>
              <PaginationCount>
                {paginaActual * PAGE_SIZE + 1}-{Math.min(filtrados.length, (paginaActual + 1) * PAGE_SIZE)} de{' '}
                {filtrados.length} usuarios
              </PaginationCount>
              {totalPaginas > 1 && (
                <PaginationContent>
                  {Array.from({ length: totalPaginas }).map((_, i) => (
                    <PaginationItem key={i}>
                      <PaginationLink isActive={i === paginaActual} onClick={() => setPagina(i)}>
                        {i + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                </PaginationContent>
              )}
            </Pagination>
          )}
        </div>
      )}

      <UsuarioDetalleDialog
        open={!!usuarioDetalle}
        onOpenChange={(open) => !open && setUsuarioDetalle(null)}
        usuario={usuarioDetalle}
        onEditarRoles={() => {
          setUsuarioEditandoRoles(usuarioDetalle)
          setUsuarioDetalle(null)
        }}
      />

      <UsuarioRolesDialog
        open={!!usuarioEditandoRoles}
        onOpenChange={(open) => !open && setUsuarioEditandoRoles(null)}
        usuario={usuarioEditandoRoles}
        roles={roles}
        onGuardado={recargar}
      />
    </div>
  )
}
