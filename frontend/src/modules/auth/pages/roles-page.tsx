import { MoreHorizontalIcon, PencilIcon, PlusIcon, ShieldCheckIcon, Trash2Icon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { FilterBar, FilterBarSpacer, FilterSearch } from '@/components/filter-bar'
import { FilterDropdown } from '@/components/filter-dropdown'
import { TableSkeleton, type ColumnaEsqueleto } from '@/components/table-skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmarEliminacion } from '@/components/confirmar-eliminacion'
import { RolDialog } from '@/modules/auth/components/rol-dialog'
import { useRoles } from '@/modules/auth/hooks/use-roles'
import { PageHeader } from '@/components/page-header'
import { eliminarRol } from '@/modules/auth/services/eliminar-rol'
import type { Rol } from '@/modules/auth/types'
import { filtrarYOrdenarRoles, type OrdenRoles } from '@/modules/auth/utils'

const COLUMNAS_ESQUELETO: ColumnaEsqueleto[] = [
  { tipo: 'texto', ancho: 'h-4 w-32', anchoAlt: 'h-4 w-44' },
  { tipo: 'texto', ancho: 'h-4 w-12', anchoAlt: 'h-4 w-48' },
  { tipo: 'accion' },
]

const OPCIONES_ORDEN: { value: OrdenRoles; label: string }[] = [
  { value: 'nombre-asc', label: 'Nombre, A-Z' },
  { value: 'nombre-desc', label: 'Nombre, Z-A' },
]

export function RolesPage() {
  const { datos: roles, cargando, error, recargar } = useRoles()
  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [rolEditando, setRolEditando] = useState<Rol | null>(null)
  const [rolAEliminar, setRolAEliminar] = useState<Rol | null>(null)

  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState<OrdenRoles>('nombre-asc')

  const filtrados = useMemo(
    () => filtrarYOrdenarRoles(roles, { busqueda, orden }),
    [roles, busqueda, orden],
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Usuarios y roles"
        accion={
          <Button
            onClick={() => {
              setRolEditando(null)
              setDialogoAbierto(true)
            }}
          >
            <PlusIcon />
            Nuevo rol
          </Button>
        }
      />

      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudieron cargar los roles</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {error}
            <Button variant="secondary" size="sm" onClick={recargar}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <FilterBar>
        <FilterSearch value={busqueda} onChange={setBusqueda} placeholder="Buscar rol" />
        <FilterBarSpacer />
        <FilterDropdown
          label={OPCIONES_ORDEN.find((o) => o.value === orden)?.label ?? 'Ordenar por'}
          align="end"
          options={OPCIONES_ORDEN}
          value={orden}
          onChange={(valor) => setOrden(valor as OrdenRoles)}
        />
      </FilterBar>

      {!cargando && filtrados.length === 0 ? (
        <Empty className="min-h-[280px] rounded-panel bg-superficie shadow-card">
          <EmptyMedia variant="icon" className="bg-violeta-suave text-violeta">
            <ShieldCheckIcon />
          </EmptyMedia>
          <EmptyTitle>
            {roles.length === 0
              ? 'Todavía no hay roles creados.'
              : 'Ningún rol coincide con la búsqueda.'}
          </EmptyTitle>
          {roles.length === 0 ? (
            <>
              <EmptyDescription>Acción sugerida: crear el primer rol del sistema.</EmptyDescription>
              <Button onClick={() => setDialogoAbierto(true)}>
                <PlusIcon />
                Nuevo rol
              </Button>
            </>
          ) : (
            <EmptyDescription>Probá ajustar la búsqueda.</EmptyDescription>
          )}
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead data-align="end">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando ? (
              <TableSkeleton columnas={COLUMNAS_ESQUELETO} filas={6} />
            ) : (
              filtrados.map((rol) => (
                <TableRow key={rol.id}>
                  <TableCell className="font-medium">{rol.nombre}</TableCell>
                  <TableCell className="text-texto-2">{rol.descripcion ?? '—'}</TableCell>
                  <TableCell data-align="end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Acciones para ${rol.nombre}`}
                        >
                          <MoreHorizontalIcon />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => {
                            setRolEditando(rol)
                            setDialogoAbierto(true)
                          }}
                        >
                          <PencilIcon className="text-petroleo" />
                          Editar rol
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setRolAEliminar(rol)}
                        >
                          <Trash2Icon />
                          Eliminar rol
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      <RolDialog
        open={dialogoAbierto}
        onOpenChange={setDialogoAbierto}
        rol={rolEditando}
        onGuardado={recargar}
      />

      {rolAEliminar && (
        <ConfirmarEliminacion
          open={!!rolAEliminar}
          onOpenChange={(open) => !open && setRolAEliminar(null)}
          titulo={`Eliminar el rol "${rolAEliminar.nombre}"`}
          descripcion="Esta acción no se puede deshacer. Si el rol tiene usuarios asignados, no se va a poder eliminar."
          onConfirmar={async () => {
            await eliminarRol(rolAEliminar.id)
            recargar()
          }}
        />
      )}
    </div>
  )
}
