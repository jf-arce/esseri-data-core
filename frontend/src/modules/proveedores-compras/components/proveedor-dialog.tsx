import { useState } from 'react'
import { AtSignIcon, BuildingIcon, PhoneIcon, TagIcon } from 'lucide-react'
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
import { actualizarProveedor } from '@/modules/proveedores-compras/services/actualizar-proveedor'
import { crearProveedor } from '@/modules/proveedores-compras/services/crear-proveedor'
import type { EstadoProveedor, Proveedor } from '@/modules/proveedores-compras/types'

// Coincide con el `Literal` de `ProveedorCreate` en el backend, que a su vez espeja el
// CheckConstraint `ck_proveedor_estado`.
const ESTADOS: { valor: EstadoProveedor; etiqueta: string }[] = [
  { valor: 'activo', etiqueta: 'Activo' },
  { valor: 'inactivo', etiqueta: 'Inactivo' },
]

interface ProveedorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proveedor: Proveedor | null
  onGuardado: () => void
}

// Mismo patrón que PermisoDialog: el formulario solo se monta mientras el diálogo está abierto,
// para que el estado inicial salga directo del `proveedor` de esa apertura sin un useEffect
// resincronizándolo en cada cambio de prop.
export function ProveedorDialog({
  open,
  onOpenChange,
  proveedor,
  onGuardado,
}: ProveedorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <ProveedorForm
            proveedor={proveedor}
            onOpenChange={onOpenChange}
            onGuardado={onGuardado}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ProveedorForm({
  proveedor,
  onOpenChange,
  onGuardado,
}: {
  proveedor: Proveedor | null
  onOpenChange: (open: boolean) => void
  onGuardado: () => void
}) {
  const [nombre, setNombre] = useState(proveedor?.nombre ?? '')
  const [categoria, setCategoria] = useState(proveedor?.categoria ?? '')
  const [telefono, setTelefono] = useState(proveedor?.telefono ?? '')
  const [email, setEmail] = useState(proveedor?.email ?? '')
  const [estado, setEstado] = useState<EstadoProveedor>(proveedor?.estado ?? 'activo')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(evento: React.FormEvent) {
    evento.preventDefault()
    setEnviando(true)
    setError(null)
    const datos = {
      nombre: nombre.trim(),
      categoria: categoria.trim() || null,
      telefono: telefono.trim() || null,
      email: email.trim() || null,
      estado,
    }
    try {
      if (proveedor) {
        await actualizarProveedor(proveedor.id, datos)
      } else {
        await crearProveedor(datos)
      }
      onGuardado()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudo guardar el proveedor.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{proveedor ? 'Editar proveedor' : 'Nuevo proveedor'}</DialogTitle>
        <DialogDescription>
          Los datos de contacto son opcionales, pero sin al menos uno no vas a poder enviarle
          órdenes de compra.
        </DialogDescription>
      </DialogHeader>

      {error && (
        <Alert variant="error" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="mt-4 flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="proveedor-nombre">Nombre</FieldLabel>
          <div className="relative">
            <BuildingIcon
              className="text-texto-3 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              id="proveedor-nombre"
              value={nombre}
              onChange={(evento) => setNombre(evento.target.value)}
              placeholder="Razón social o nombre"
              className="pl-9"
              required
            />
          </div>
        </Field>
        <Field>
          <FieldLabel htmlFor="proveedor-categoria">Categoría (opcional)</FieldLabel>
          <div className="relative">
            <TagIcon
              className="text-texto-3 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              id="proveedor-categoria"
              value={categoria}
              onChange={(evento) => setCategoria(evento.target.value)}
              placeholder="ej. Librería"
              className="pl-9"
            />
          </div>
        </Field>
        <Field>
          <FieldLabel htmlFor="proveedor-telefono">Teléfono (opcional)</FieldLabel>
          <div className="relative">
            <PhoneIcon
              className="text-texto-3 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              id="proveedor-telefono"
              type="tel"
              value={telefono}
              onChange={(evento) => setTelefono(evento.target.value)}
              placeholder="221-555-0100"
              className="pl-9"
            />
          </div>
        </Field>
        <Field>
          <FieldLabel htmlFor="proveedor-email">Email (opcional)</FieldLabel>
          <div className="relative">
            <AtSignIcon
              className="text-texto-3 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              id="proveedor-email"
              type="email"
              value={email}
              onChange={(evento) => setEmail(evento.target.value)}
              placeholder="ventas@proveedor.com.ar"
              className="pl-9"
            />
          </div>
        </Field>
        <Field>
          <FieldLabel htmlFor="proveedor-estado">Estado</FieldLabel>
          <Select value={estado} onValueChange={(valor) => setEstado(valor as EstadoProveedor)}>
            <SelectTrigger id="proveedor-estado" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ESTADOS.map((opcion) => (
                <SelectItem key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <DialogFooter className="mt-6">
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="submit" disabled={enviando}>
          {proveedor ? 'Guardar cambios' : 'Crear proveedor'}
        </Button>
      </DialogFooter>
    </form>
  )
}
