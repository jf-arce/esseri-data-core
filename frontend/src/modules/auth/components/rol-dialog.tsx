import { useState } from 'react'
import { ApiError } from '@/api/client'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { actualizarRol } from '@/modules/auth/services/actualizar-rol'
import { crearRol } from '@/modules/auth/services/crear-rol'
import type { Rol } from '@/modules/auth/types'

interface RolDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rol: Rol | null
  onGuardado: () => void
}

// El formulario solo se monta mientras el diálogo está abierto: así el estado inicial de cada
// campo se computa directamente del `rol` de esa apertura (sin useEffect resincronizándolo) y
// cada apertura nueva arranca con inputs limpios, sin arrastrar el valor de la anterior.
export function RolDialog({ open, onOpenChange, rol, onGuardado }: RolDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && <RolForm rol={rol} onOpenChange={onOpenChange} onGuardado={onGuardado} />}
      </DialogContent>
    </Dialog>
  )
}

function RolForm({
  rol,
  onOpenChange,
  onGuardado,
}: {
  rol: Rol | null
  onOpenChange: (open: boolean) => void
  onGuardado: () => void
}) {
  const [nombre, setNombre] = useState(rol?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(rol?.descripcion ?? '')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(evento: React.FormEvent) {
    evento.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      if (rol) {
        await actualizarRol(rol.id, { nombre, descripcion })
      } else {
        await crearRol(nombre, descripcion)
      }
      onGuardado()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudo guardar el rol.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{rol ? 'Editar rol' : 'Nuevo rol'}</DialogTitle>
        <DialogDescription>
          {rol
            ? 'Actualizá el nombre o la descripción del rol.'
            : 'Definí un rol para agrupar permisos y asignarlo a usuarios.'}
        </DialogDescription>
      </DialogHeader>

      {error && (
        <Alert variant="error" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="mt-4 flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="rol-nombre">Nombre</FieldLabel>
          <Input
            id="rol-nombre"
            value={nombre}
            onChange={(evento) => setNombre(evento.target.value)}
            required
            autoFocus
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="rol-descripcion">Descripción</FieldLabel>
          <Textarea
            id="rol-descripcion"
            value={descripcion}
            onChange={(evento) => setDescripcion(evento.target.value)}
            rows={3}
          />
        </Field>
      </div>

      <DialogFooter className="mt-6">
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="submit" disabled={enviando}>
          {rol ? 'Guardar cambios' : 'Crear rol'}
        </Button>
      </DialogFooter>
    </form>
  )
}
