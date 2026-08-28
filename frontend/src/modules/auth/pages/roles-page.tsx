import { MoreHorizontalIcon, PlusIcon, ShieldCheckIcon } from 'lucide-react'
import { useState } from 'react'
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
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmarEliminacion } from '@/modules/auth/components/confirmar-eliminacion'
import { RolDialog } from '@/modules/auth/components/rol-dialog'
import { useRoles } from '@/modules/auth/hooks/use-roles'
import { SeccionHeader } from '@/modules/auth/pages/configuracion-acceso-page'
import { eliminarRol } from '@/modules/auth/services/eliminar-rol'
import type { Rol } from '@/modules/auth/types'

function FilaEsqueleto() {
  return (
    <TableRow>
      <TableCell>
        <Skeleton className="h-4 w-36" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-56" />
      </TableCell>
      <TableCell data-align="end">
        <Skeleton className="ml-auto size-8 rounded-full" />
      </TableCell>
    </TableRow>
  )
}

export function RolesPage() {
  const { datos: roles, cargando, error, recargar } = useRoles()
  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [rolEditando, setRolEditando] = useState<Rol | null>(null)
  const [rolAEliminar, setRolAEliminar] = useState<Rol | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <SeccionHeader
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

      {!cargando && roles.length === 0 ? (
        <Empty className="rounded-panel bg-superficie shadow-card">
          <EmptyMedia variant="icon" className="bg-violeta-suave text-violeta">
            <ShieldCheckIcon />
          </EmptyMedia>
          <EmptyTitle>Todavía no hay roles creados.</EmptyTitle>
          <EmptyDescription>Acción sugerida: crear el primer rol del sistema.</EmptyDescription>
          <Button onClick={() => setDialogoAbierto(true)}>
            <PlusIcon />
            Nuevo rol
          </Button>
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
              Array.from({ length: 4 }).map((_, i) => <FilaEsqueleto key={i} />)
            ) : (
              roles.map((rol) => (
                <TableRow key={rol.id}>
                  <TableCell className="font-medium">{rol.nombre}</TableCell>
                  <TableCell className="text-texto-2">{rol.descripcion ?? '—'}</TableCell>
                  <TableCell data-align="end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Acciones para ${rol.nombre}`}>
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
                          Editar rol
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setRolAEliminar(rol)}>
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
