import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { colorIdentidad, formatearFechaHora, inicialesDeUsuario, nombreDeUsuario } from '@/modules/auth/utils'
import type { UsuarioConRoles } from '@/modules/auth/types'

interface UsuarioDetalleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  usuario: UsuarioConRoles | null
  onEditarRoles: () => void
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-texto-2">{etiqueta}</span>
      <span className="font-semibold text-texto">{valor}</span>
    </div>
  )
}

// Vista `Usuarios y roles · Ver detalle` del mock: avatar grande + nombre/mail, filas
// clave/valor, pie con "Cerrar" y "Editar roles". Los datos ya están cargados en la lista
// (no dispara un request propio).
export function UsuarioDetalleDialog({
  open,
  onOpenChange,
  usuario,
  onEditarRoles,
}: UsuarioDetalleDialogProps) {
  if (!usuario) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="flex-row items-center gap-3.5 space-y-0">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-full text-base font-semibold text-superficie"
            style={{ backgroundColor: colorIdentidad(usuario.id) }}
          >
            {inicialesDeUsuario(usuario.email)}
          </div>
          <div>
            <DialogTitle>{nombreDeUsuario(usuario.email)}</DialogTitle>
            <p className="text-xs text-texto-2">{usuario.email}</p>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-3.5">
          <Fila
            etiqueta="Roles"
            valor={usuario.roles.length ? usuario.roles.map((rol) => rol.nombre).join(', ') : 'Sin rol'}
          />
          <Fila
            etiqueta="Acceso"
            valor={usuario.auth_provider === 'google' ? 'Google (institucional)' : 'Correo y contraseña'}
          />
          <Fila etiqueta="Estado" valor={usuario.estado === 'activo' ? 'Activo' : 'Inactivo'} />
          <Fila etiqueta="Último acceso" valor={formatearFechaHora(usuario.ultimo_acceso)} />
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button onClick={onEditarRoles}>Editar roles</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
