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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { crearDocenteDesdeUsuario } from '@/modules/academico/services/docentes'
import { ROL_DOCENTE } from '@/modules/auth/constants'
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
  const [legajoDocente, setLegajoDocente] = useState('')

  useEffect(() => {
    getRolesDeUsuario(usuario.id)
      .then((rolesDelUsuario) => setSeleccionados(new Set(rolesDelUsuario.map((r) => r.id))))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rolDocente = roles.find((r) => r.codigo === ROL_DOCENTE)
  const teniaRolDocente = usuario.roles.some((r) => r.codigo === ROL_DOCENTE)
  // Sumar "docente" a una cuenta sin ficha propia le crea la ficha Docente (con legajo), en vez
  // de un simple POST /usuarios/{id}/roles — por eso ese rol pide un dato extra acá.
  const sumandoRolDocente =
    rolDocente !== undefined && !teniaRolDocente && seleccionados.has(rolDocente.id)

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
      if (sumandoRolDocente && rolDocente) {
        await crearDocenteDesdeUsuario({ usuario_id: usuario.id, legajo: legajoDocente })
      }
      await Promise.all([
        ...aAgregar
          .filter((rolId) => rolId !== rolDocente?.id)
          .map((rolId) => asignarRolAUsuario(usuario.id, rolId)),
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

      {usuario.persona_id === null && (
        <Alert className="mt-2">
          <AlertDescription>
            Esta cuenta no tiene una persona asociada: no se le puede sumar el rol docente desde
            acá.
          </AlertDescription>
        </Alert>
      )}

      <div className="mt-2 flex max-h-80 flex-col gap-2.5 overflow-y-auto">
        {roles.map((rol) => {
          const esDocenteSinPersona =
            rol.codigo === ROL_DOCENTE && !teniaRolDocente && usuario.persona_id === null
          return (
            <Label key={rol.id} className="flex items-center gap-2.5 font-normal">
              <Checkbox
                checked={seleccionados.has(rol.id)}
                disabled={esDocenteSinPersona}
                onCheckedChange={() => toggle(rol.id)}
              />
              {rol.nombre}
            </Label>
          )
        })}
      </div>

      {sumandoRolDocente && (
        <div className="mt-3 flex flex-col gap-1.5">
          <Label htmlFor="legajo-docente">Legajo del docente</Label>
          <Input
            id="legajo-docente"
            value={legajoDocente}
            onChange={(e) => setLegajoDocente(e.target.value)}
            placeholder="Ej: DOC-000123"
          />
        </div>
      )}

      <DialogFooter className="mt-6">
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button
          type="button"
          disabled={enviando || (sumandoRolDocente && legajoDocente.trim() === '')}
          onClick={handleGuardar}
        >
          Guardar cambios
        </Button>
      </DialogFooter>
    </>
  )
}
