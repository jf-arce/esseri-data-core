import { MoreHorizontalIcon, PlusIcon, ShieldCheckIcon } from 'lucide-react'
import { useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
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
import { PermisoDialog } from '@/modules/auth/components/permiso-dialog'
import { usePermisos } from '@/modules/auth/hooks/use-permisos'
import { SeccionHeader } from '@/modules/auth/pages/configuracion-acceso-page'
import { eliminarPermiso } from '@/modules/auth/services/eliminar-permiso'
import type { Permiso } from '@/modules/auth/types'

// Mapeo del nombre de módulo (texto libre, coincide con `MODULOS` de `permiso-dialog.tsx`) al
// `data-modulo` del Badge (§9.3 DESIGN.md, familia de 8 dominios). "Autenticación" y "Panel
// Administrativo" no son dominios de negocio del sistema, así que no tienen color de módulo
// propio: quedan en el chip neutro.
const MODULO_A_BADGE: Record<string, string | undefined> = {
  'Familias y Alumnos': 'familias',
  Académico: 'academico',
  Inscripciones: 'inscripciones',
  Facturación: 'facturacion',
  'Proveedores y Compras': 'compras',
  Workflows: 'workflows',
  Auditoría: 'auditoria',
  'IA/Sugerencias': 'ia',
}

function BadgeModulo({ modulo }: { modulo: string }) {
  const clave = MODULO_A_BADGE[modulo]
  if (!clave) return <Badge variant="secondary">{modulo}</Badge>
  return (
    <Badge variant="modulo" data-modulo={clave}>
      {modulo}
    </Badge>
  )
}

function FilaEsqueleto() {
  return (
    <TableRow>
      <TableCell>
        <Skeleton className="h-[22px] w-32 rounded-full" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-20" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-28" />
      </TableCell>
      <TableCell data-align="end">
        <Skeleton className="ml-auto size-8 rounded-full" />
      </TableCell>
    </TableRow>
  )
}

export function PermisosPage() {
  const { datos: permisos, cargando, error, recargar } = usePermisos()
  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [permisoEditando, setPermisoEditando] = useState<Permiso | null>(null)
  const [permisoAEliminar, setPermisoAEliminar] = useState<Permiso | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <SeccionHeader
        titulo="Usuarios y roles"
        accion={
          <Button
            onClick={() => {
              setPermisoEditando(null)
              setDialogoAbierto(true)
            }}
          >
            <PlusIcon />
            Nuevo permiso
          </Button>
        }
      />

      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudieron cargar los permisos</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {error}
            <Button variant="secondary" size="sm" onClick={recargar}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!cargando && permisos.length === 0 ? (
        <Empty className="rounded-panel bg-superficie shadow-card">
          <EmptyMedia variant="icon" className="bg-violeta-suave text-violeta">
            <ShieldCheckIcon />
          </EmptyMedia>
          <EmptyTitle>Todavía no hay permisos creados.</EmptyTitle>
          <EmptyDescription>Acción sugerida: crear el primer permiso del sistema.</EmptyDescription>
          <Button onClick={() => setDialogoAbierto(true)}>
            <PlusIcon />
            Nuevo permiso
          </Button>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Módulo</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Tipo de información</TableHead>
              <TableHead data-align="end">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando ? (
              Array.from({ length: 4 }).map((_, i) => <FilaEsqueleto key={i} />)
            ) : (
              permisos.map((permiso) => (
                <TableRow key={permiso.id}>
                  <TableCell>
                    <BadgeModulo modulo={permiso.modulo} />
                  </TableCell>
                  <TableCell className="text-texto-2">{permiso.accion}</TableCell>
                  <TableCell className="text-texto-2">{permiso.tipo_informacion ?? '—'}</TableCell>
                  <TableCell data-align="end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Acciones para ${permiso.codigo}`}
                        >
                          <MoreHorizontalIcon />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => {
                            setPermisoEditando(permiso)
                            setDialogoAbierto(true)
                          }}
                        >
                          Editar permiso
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setPermisoAEliminar(permiso)}
                        >
                          Eliminar permiso
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

      <PermisoDialog
        open={dialogoAbierto}
        onOpenChange={setDialogoAbierto}
        permiso={permisoEditando}
        onGuardado={recargar}
      />

      {permisoAEliminar && (
        <ConfirmarEliminacion
          open={!!permisoAEliminar}
          onOpenChange={(open) => !open && setPermisoAEliminar(null)}
          titulo={`Eliminar el permiso "${permisoAEliminar.modulo} · ${permisoAEliminar.accion}"`}
          descripcion="Esta acción no se puede deshacer y lo va a quitar de todos los roles que lo tengan asignado."
          onConfirmar={async () => {
            await eliminarPermiso(permisoAEliminar.id)
            recargar()
          }}
        />
      )}
    </div>
  )
}
