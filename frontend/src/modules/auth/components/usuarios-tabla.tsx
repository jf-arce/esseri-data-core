import { EyeIcon, MoreHorizontalIcon, PencilIcon } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Pagination,
  PaginationContent,
  PaginationCount,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination'
import { TableSkeleton, type ColumnaEsqueleto } from '@/components/table-skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { UsuarioConRoles } from '@/modules/auth/types'
import {
  colorIdentidad,
  formatearFechaHora,
  formatearNombreRol,
  inicialesDeUsuario,
  nombreDeUsuario,
} from '@/modules/auth/utils'

const COLUMNAS_ESQUELETO: ColumnaEsqueleto[] = [
  { tipo: 'avatar', ancho: 'h-4 w-32', anchoAlt: 'h-4 w-24' },
  { tipo: 'chips' },
  { tipo: 'texto', ancho: 'h-4 w-28', anchoAlt: 'h-4 w-20' },
  { tipo: 'chip', ancho: 'w-16', anchoAlt: 'w-20' },
  { tipo: 'accion' },
]

function RolChip({ nombre, id }: { nombre: string; id: string }) {
  const color = colorIdentidad(id)
  return (
    <span
      className="inline-flex h-[22px] shrink-0 items-center rounded-full px-2.5 text-xs font-semibold whitespace-nowrap"
      style={{ backgroundColor: `color-mix(in oklch, ${color} 12%, white)`, color }}
    >
      {formatearNombreRol(nombre)}
    </span>
  )
}

interface UsuariosTablaProps {
  visibles: UsuarioConRoles[]
  cargando: boolean
  densidad: 'comfortable' | 'compact'
  pageSize: number
  totalFiltrados: number
  paginaActual: number
  totalPaginas: number
  onCambiarPagina: (pagina: number) => void
  onVerDetalle: (usuario: UsuarioConRoles) => void
  onEditarRoles: (usuario: UsuarioConRoles) => void
}

function UsuariosTabla({
  visibles,
  cargando,
  densidad,
  pageSize,
  totalFiltrados,
  paginaActual,
  totalPaginas,
  onCambiarPagina,
  onVerDetalle,
  onEditarRoles,
}: UsuariosTablaProps) {
  return (
    <div className="overflow-hidden rounded-panel bg-superficie shadow-card">
      <Table bare data-density={densidad === 'compact' ? 'compact' : undefined}>
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
            <TableSkeleton columnas={COLUMNAS_ESQUELETO} filas={pageSize} />
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
                      <DropdownMenuItem onSelect={() => onVerDetalle(usuario)}>
                        <EyeIcon className="text-violeta" />
                        Ver detalle
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onEditarRoles(usuario)}>
                        <PencilIcon className="text-petroleo" />
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

      {!cargando && totalFiltrados > 0 && (
        <Pagination>
          <PaginationCount>
            {paginaActual * pageSize + 1}-{Math.min(totalFiltrados, (paginaActual + 1) * pageSize)} de{' '}
            {totalFiltrados} usuarios
          </PaginationCount>
          {totalPaginas > 1 && (
            <PaginationContent>
              {Array.from({ length: totalPaginas }).map((_, i) => (
                <PaginationItem key={i}>
                  <PaginationLink isActive={i === paginaActual} onClick={() => onCambiarPagina(i)}>
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}
            </PaginationContent>
          )}
        </Pagination>
      )}
    </div>
  )
}

export { UsuariosTabla }
