import { useState } from 'react'
import { PackageIcon, RulerIcon, TagIcon } from 'lucide-react'
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
import { Switch } from '@/components/ui/switch'
import { actualizarProducto } from '@/modules/proveedores-compras/services/actualizar-producto'
import { crearProducto } from '@/modules/proveedores-compras/services/crear-producto'
import type { ProductoServicio, TipoProductoServicio } from '@/modules/proveedores-compras/types'

// Coincide con el `Literal` del backend, que espeja el CheckConstraint
// `ck_producto_servicio_tipo`.
const TIPOS: { valor: TipoProductoServicio; etiqueta: string }[] = [
  { valor: 'producto', etiqueta: 'Producto' },
  { valor: 'servicio', etiqueta: 'Servicio' },
]

interface ProductoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  producto: ProductoServicio | null
  onGuardado: () => void
}

export function ProductoDialog({ open, onOpenChange, producto, onGuardado }: ProductoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <ProductoForm producto={producto} onOpenChange={onOpenChange} onGuardado={onGuardado} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ProductoForm({
  producto,
  onOpenChange,
  onGuardado,
}: {
  producto: ProductoServicio | null
  onOpenChange: (open: boolean) => void
  onGuardado: () => void
}) {
  const [nombre, setNombre] = useState(producto?.nombre ?? '')
  const [categoria, setCategoria] = useState(producto?.categoria ?? '')
  const [unidad, setUnidad] = useState(producto?.unidad ?? '')
  const [tipo, setTipo] = useState<TipoProductoServicio>(producto?.tipo ?? 'producto')
  const [activo, setActivo] = useState(producto?.activo ?? true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(evento: React.FormEvent) {
    evento.preventDefault()
    setEnviando(true)
    setError(null)
    const datos = {
      nombre: nombre.trim(),
      categoria: categoria.trim() || null,
      unidad: unidad.trim() || null,
      tipo,
      activo,
    }
    try {
      if (producto) {
        await actualizarProducto(producto.id, datos)
      } else {
        await crearProducto(datos)
      }
      onGuardado()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudo guardar el ítem.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{producto ? 'Editar ítem' : 'Nuevo ítem del catálogo'}</DialogTitle>
        <DialogDescription>
          El catálogo es el maestro de lo que ESSERI compra. Un ítem inactivo deja de aparecer en
          compras nuevas, pero se conserva en las que ya lo usaron.
        </DialogDescription>
      </DialogHeader>

      {error && (
        <Alert variant="error" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="mt-4 flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="producto-nombre">Nombre</FieldLabel>
          <div className="relative">
            <PackageIcon
              className="text-texto-3 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              id="producto-nombre"
              value={nombre}
              onChange={(evento) => setNombre(evento.target.value)}
              placeholder="ej. Resma de papel A4"
              className="pl-9"
              required
            />
          </div>
        </Field>
        <Field>
          <FieldLabel htmlFor="producto-tipo">Tipo</FieldLabel>
          <Select value={tipo} onValueChange={(valor) => setTipo(valor as TipoProductoServicio)}>
            <SelectTrigger id="producto-tipo" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS.map((opcion) => (
                <SelectItem key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="producto-categoria">Categoría (opcional)</FieldLabel>
          <div className="relative">
            <TagIcon
              className="text-texto-3 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              id="producto-categoria"
              value={categoria}
              onChange={(evento) => setCategoria(evento.target.value)}
              placeholder="ej. Librería"
              className="pl-9"
            />
          </div>
        </Field>
        <Field>
          <FieldLabel htmlFor="producto-unidad">Unidad (opcional)</FieldLabel>
          <div className="relative">
            <RulerIcon
              className="text-texto-3 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              id="producto-unidad"
              value={unidad}
              onChange={(evento) => setUnidad(evento.target.value)}
              placeholder="ej. unidad, caja, hora"
              className="pl-9"
            />
          </div>
        </Field>
        <Field orientation="horizontal">
          <FieldLabel htmlFor="producto-activo">Disponible para compras nuevas</FieldLabel>
          <Switch id="producto-activo" checked={activo} onCheckedChange={setActivo} />
        </Field>
      </div>

      <DialogFooter className="mt-6">
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="submit" disabled={enviando}>
          {producto ? 'Guardar cambios' : 'Crear ítem'}
        </Button>
      </DialogFooter>
    </form>
  )
}
