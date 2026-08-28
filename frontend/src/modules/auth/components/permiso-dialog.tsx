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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { actualizarPermiso } from '@/modules/auth/services/actualizar-permiso'
import { crearPermiso } from '@/modules/auth/services/crear-permiso'

// Vocabulario fijo de módulo/acción: coincide con `ModuloLiteral`/`AccionLiteral` del backend
// (`backend/src/auth/constants.py`), que es lo que valida `PermisoCreate`/`PermisoUpdate`.
const MODULOS = [
  'Autenticación',
  'Familias y Alumnos',
  'Académico',
  'Inscripciones',
  'Facturación',
  'Proveedores y Compras',
  'Workflows',
  'Auditoría',
  'Panel Administrativo',
  'IA/Sugerencias',
]

const ACCIONES = ['crear', 'leer', 'actualizar', 'eliminar', 'exportar']

type PermisoEditable = {
  id: string
  modulo: string
  accion: string
  tipo_informacion: string | null
}

interface PermisoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  permiso: PermisoEditable | null
  onGuardado: () => void
}

// Mismo patrón que RolDialog: el formulario solo se monta mientras el diálogo está abierto,
// para que el estado inicial salga directo del `permiso` de esa apertura sin un useEffect
// resincronizándolo en cada cambio de prop.
export function PermisoDialog({ open, onOpenChange, permiso, onGuardado }: PermisoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <PermisoForm permiso={permiso} onOpenChange={onOpenChange} onGuardado={onGuardado} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function PermisoForm({
  permiso,
  onOpenChange,
  onGuardado,
}: {
  permiso: PermisoEditable | null
  onOpenChange: (open: boolean) => void
  onGuardado: () => void
}) {
  const [modulo, setModulo] = useState(permiso?.modulo ?? '')
  const [accion, setAccion] = useState(permiso?.accion ?? '')
  const [tipoInformacion, setTipoInformacion] = useState(permiso?.tipo_informacion ?? '')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(evento: React.FormEvent) {
    evento.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      if (permiso) {
        await actualizarPermiso(permiso.id, {
          modulo,
          accion,
          tipo_informacion: tipoInformacion || null,
        })
      } else {
        await crearPermiso(modulo, accion, tipoInformacion || undefined)
      }
      onGuardado()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudo guardar el permiso.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{permiso ? 'Editar permiso' : 'Nuevo permiso'}</DialogTitle>
        <DialogDescription>
          Un permiso es la combinación de un módulo y una acción. Acotalo a un tipo de información
          solo si necesita recortarse a datos sensibles puntuales.
        </DialogDescription>
      </DialogHeader>

      {error && (
        <Alert variant="error" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="mt-4 flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="permiso-modulo">Módulo</FieldLabel>
          <Select value={modulo} onValueChange={setModulo} required>
            <SelectTrigger id="permiso-modulo" className="w-full">
              <SelectValue placeholder="Elegí un módulo" />
            </SelectTrigger>
            <SelectContent>
              {MODULOS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="permiso-accion">Acción</FieldLabel>
          <Select value={accion} onValueChange={setAccion} required>
            <SelectTrigger id="permiso-accion" className="w-full">
              <SelectValue placeholder="Elegí una acción" />
            </SelectTrigger>
            <SelectContent>
              {ACCIONES.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="permiso-tipo">Tipo de información (opcional)</FieldLabel>
          <Input
            id="permiso-tipo"
            value={tipoInformacion}
            onChange={(evento) => setTipoInformacion(evento.target.value)}
            placeholder="ej. datos_medicos"
          />
        </Field>
      </div>

      <DialogFooter className="mt-6">
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="submit" disabled={enviando}>
          {permiso ? 'Guardar cambios' : 'Crear permiso'}
        </Button>
      </DialogFooter>
    </form>
  )
}
