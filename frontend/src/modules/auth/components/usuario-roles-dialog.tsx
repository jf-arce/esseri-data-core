import { useEffect, useState } from 'react'
import { ApiError } from '@/api/client'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { asignarRolAUsuario } from '@/modules/auth/services/asignar-rol-a-usuario'
import { getRolesDeUsuario } from '@/modules/auth/services/get-roles-de-usuario'
import { quitarRolAUsuario } from '@/modules/auth/services/quitar-rol-a-usuario'
import type { Rol, UsuarioConRoles } from '@/modules/auth/types'

interface UsuarioRolesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  usuario: UsuarioConRoles | null
  roles: Rol[]
  onGuardado: () => void
}

// Mismo patrón que RolDialog/PermisoDialog: el contenido solo se monta mientras el diálogo
// está abierto, así el fetch de roles del usuario corre una sola vez por apertura (efecto de
// montaje, sin dependencias que resincronizar) en vez de reaccionar a cambios de prop.
export function UsuarioRolesDialog({
  open,
  onOpenChange,
  usuario,
  roles,
  onGuardado,
}: UsuarioRolesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && usuario && (
          <UsuarioRolesForm
            usuario={usuario}
            roles={roles}
            onOpenChange={onOpenChange}
            onGuardado={onGuardado}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function UsuarioRolesForm({
  usuario,
  roles,
  onOpenChange,
  onGuardado,
}: {
  usuario: UsuarioConRoles
  roles: Rol[]
  onOpenChange: (open: boolean) => void
  onGuardado: () => void
}) {
  const [seleccionados, setSeleccionados] = useState<Set<string>>(
    () => new Set(usuario.roles.map((r) => r.id)),
  )
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getRolesDeUsuario(usuario.id)
      .then((rolesDelUsuario) => setSeleccionados(new Set(rolesDelUsuario.map((r) => r.id))))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggle(rolId: string) {
    setSeleccionados((prev) => {
      const siguiente = new Set(prev)
      if (siguiente.has(rolId)) {
        siguiente.delete(rolId)
      } else {
        siguiente.add(rolId)
      }
      return siguiente
    })
  }

  async function handleGuardar() {
    setEnviando(true)
    setError(null)

    const originales = new Set(usuario.roles.map((r) => r.id))
    const aAgregar = [...seleccionados].filter((id) => !originales.has(id))
    const aQuitar = [...originales].filter((id) => !seleccionados.has(id))

    try {
      await Promise.all([
        ...aAgregar.map((rolId) => asignarRolAUsuario(usuario.id, rolId)),
        ...aQuitar.map((rolId) => quitarRolAUsuario(usuario.id, rolId)),
      ])
      onGuardado()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudieron guardar los roles.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Editar roles</DialogTitle>
        <DialogDescription>Roles asignados a {usuario.email}.</DialogDescription>
      </DialogHeader>

      {error && (
        <Alert variant="error" className="mt-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="mt-2 flex max-h-80 flex-col gap-2.5 overflow-y-auto">
        {roles.map((rol) => (
          <Label key={rol.id} className="flex items-center gap-2.5 font-normal">
            <Checkbox checked={seleccionados.has(rol.id)} onCheckedChange={() => toggle(rol.id)} />
            {rol.nombre}
          </Label>
        ))}
      </div>

      <DialogFooter className="mt-6">
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="button" disabled={enviando} onClick={handleGuardar}>
          Guardar cambios
        </Button>
      </DialogFooter>
    </>
  )
}
