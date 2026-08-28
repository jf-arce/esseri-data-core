import { PencilIcon, PlusIcon, ShieldCheckIcon, Trash2Icon, UsersRoundIcon } from 'lucide-react'
import { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmarEliminacion } from '@/modules/auth/components/confirmar-eliminacion'
import { MatrizPermisos } from '@/modules/auth/components/matriz-permisos'
import { PermisoDialog } from '@/modules/auth/components/permiso-dialog'
import { RolDialog } from '@/modules/auth/components/rol-dialog'
import { UsuarioRolesDialog } from '@/modules/auth/components/usuario-roles-dialog'
import { useMatrizPermisos } from '@/modules/auth/hooks/use-matriz-permisos'
import { usePermisos } from '@/modules/auth/hooks/use-permisos'
import { useRoles } from '@/modules/auth/hooks/use-roles'
import { useUsuarios } from '@/modules/auth/hooks/use-usuarios'
import { eliminarPermiso } from '@/modules/auth/services/eliminar-permiso'
import { eliminarRol } from '@/modules/auth/services/eliminar-rol'
import type { Permiso, Rol, UsuarioConRoles } from '@/modules/auth/types'

function FilaEsqueleto({ columnas }: { columnas: number }) {
  return (
    <TableRow>
      {Array.from({ length: columnas }).map((_, i) => (
        <TableCell key={i}>
          <Skeleton className="h-4 w-full" />
        </TableCell>
      ))}
    </TableRow>
  )
}

function RolesTab() {
  const { datos: roles, cargando, error, recargar } = useRoles()
  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [rolEditando, setRolEditando] = useState<Rol | null>(null)
  const [rolAEliminar, setRolAEliminar] = useState<Rol | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setRolEditando(null)
            setDialogoAbierto(true)
          }}
        >
          <PlusIcon />
          Nuevo rol
        </Button>
      </div>

      {error && (
        <Alert variant="error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-[20px] bg-superficie shadow-[0_6px_20px_rgba(20,17,26,0.06)]">
        {!cargando && roles.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon" className="bg-violeta-suave text-violeta">
              <ShieldCheckIcon />
            </EmptyMedia>
            <EmptyTitle>Todavía no hay roles creados.</EmptyTitle>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="w-24 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargando ? (
                <FilaEsqueleto columnas={3} />
              ) : (
                roles.map((rol) => (
                  <TableRow key={rol.id}>
                    <TableCell className="font-medium">{rol.nombre}</TableCell>
                    <TableCell className="text-texto-2">{rol.descripcion ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Editar ${rol.nombre}`}
                        onClick={() => {
                          setRolEditando(rol)
                          setDialogoAbierto(true)
                        }}
                      >
                        <PencilIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Eliminar ${rol.nombre}`}
                        onClick={() => setRolAEliminar(rol)}
                      >
                        <Trash2Icon />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

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

function PermisosTab() {
  const { datos: permisos, cargando, error, recargar } = usePermisos()
  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [permisoEditando, setPermisoEditando] = useState<Permiso | null>(null)
  const [permisoAEliminar, setPermisoAEliminar] = useState<Permiso | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setPermisoEditando(null)
            setDialogoAbierto(true)
          }}
        >
          <PlusIcon />
          Nuevo permiso
        </Button>
      </div>

      {error && (
        <Alert variant="error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-[20px] bg-superficie shadow-[0_6px_20px_rgba(20,17,26,0.06)]">
        {!cargando && permisos.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon" className="bg-violeta-suave text-violeta">
              <ShieldCheckIcon />
            </EmptyMedia>
            <EmptyTitle>Todavía no hay permisos creados.</EmptyTitle>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Módulo</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Tipo de información</TableHead>
                <TableHead className="w-24 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargando ? (
                <FilaEsqueleto columnas={4} />
              ) : (
                permisos.map((permiso) => (
                  <TableRow key={permiso.id}>
                    <TableCell className="font-medium">{permiso.modulo}</TableCell>
                    <TableCell className="text-texto-2">{permiso.accion}</TableCell>
                    <TableCell className="text-texto-2">
                      {permiso.tipo_informacion ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Editar ${permiso.codigo}`}
                        onClick={() => {
                          setPermisoEditando(permiso)
                          setDialogoAbierto(true)
                        }}
                      >
                        <PencilIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Eliminar ${permiso.codigo}`}
                        onClick={() => setPermisoAEliminar(permiso)}
                      >
                        <Trash2Icon />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

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

function MatrizTab() {
  const matriz = useMatrizPermisos()

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-[640px] text-sm text-texto-2">
        Cada permiso puede acotarse además a un tipo de información (ej. datos médicos, económicos):
        el cruce rol×acción de abajo es el nivel de módulo, el recorte por tipo de dato sensible se
        edita desde el detalle de cada permiso.
      </p>

      {matriz.error && (
        <Alert variant="error">
          <AlertDescription>{matriz.error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-2">
        {matriz.hayCambiosPendientes && (
          <Button variant="secondary" onClick={matriz.descartarCambios} disabled={matriz.guardando}>
            Descartar cambios
          </Button>
        )}
        <Button
          onClick={matriz.guardarCambios}
          disabled={!matriz.hayCambiosPendientes || matriz.guardando}
        >
          Guardar cambios
        </Button>
      </div>

      {matriz.cargando ? (
        <Skeleton className="h-96 w-full rounded-[20px]" />
      ) : (
        <MatrizPermisos matriz={matriz} />
      )}
    </div>
  )
}

function UsuariosTab() {
  const { datos: usuarios, cargando, error, recargar } = useUsuarios()
  const { datos: roles } = useRoles()
  const [usuarioEditando, setUsuarioEditando] = useState<UsuarioConRoles | null>(null)

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-[20px] bg-superficie shadow-[0_6px_20px_rgba(20,17,26,0.06)]">
        {!cargando && usuarios.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon" className="bg-violeta-suave text-violeta">
              <UsersRoundIcon />
            </EmptyMedia>
            <EmptyTitle>Todavía no hay usuarios cargados.</EmptyTitle>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-24 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargando ? (
                <FilaEsqueleto columnas={4} />
              ) : (
                usuarios.map((usuario) => (
                  <TableRow key={usuario.id}>
                    <TableCell className="font-medium">{usuario.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {usuario.roles.length === 0 ? (
                          <span className="text-texto-3">Sin rol</span>
                        ) : (
                          usuario.roles.map((rol) => (
                            <Badge key={rol.id} variant="secondary">
                              {rol.nombre}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={usuario.estado === 'activo' ? 'exito' : 'advertencia'}>
                        {usuario.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Editar roles de ${usuario.email}`}
                        onClick={() => setUsuarioEditando(usuario)}
                      >
                        <PencilIcon />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <UsuarioRolesDialog
        open={!!usuarioEditando}
        onOpenChange={(open) => !open && setUsuarioEditando(null)}
        usuario={usuarioEditando}
        roles={roles}
        onGuardado={recargar}
      />
    </div>
  )
}

export function ConfiguracionAccesoPage() {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold tracking-[.08em] text-texto-3 uppercase">
        Configuración
      </p>
      <h1 className="mb-6 text-2xl font-semibold tracking-[-.01em] text-texto">Usuarios y roles</h1>

      <Tabs defaultValue="roles">
        <TabsList className="mb-6">
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="permisos">Permisos</TabsTrigger>
          <TabsTrigger value="matriz">Matriz</TabsTrigger>
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
        </TabsList>
        <TabsContent value="roles">
          <RolesTab />
        </TabsContent>
        <TabsContent value="permisos">
          <PermisosTab />
        </TabsContent>
        <TabsContent value="matriz">
          <MatrizTab />
        </TabsContent>
        <TabsContent value="usuarios">
          <UsuariosTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
