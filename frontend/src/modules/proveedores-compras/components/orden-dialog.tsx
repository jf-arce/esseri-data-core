import { useState } from 'react'
import { CalendarIcon, PlusIcon, Trash2Icon, TruckIcon } from 'lucide-react'
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
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { crearOrden } from '@/modules/proveedores-compras/services/crear-orden'
import type {
  ProductoServicio,
  Proveedor,
  SolicitudCompra,
} from '@/modules/proveedores-compras/types'
import { descripcionSolicitud } from '@/modules/proveedores-compras/utils'

interface LineaDetalle {
  productoId: string
  cantidad: string
}

interface OrdenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proveedores: Proveedor[]
  solicitudesAprobadas: SolicitudCompra[]
  productosActivos: ProductoServicio[]
  onGuardado: () => void
}

export function OrdenDialog({
  open,
  onOpenChange,
  proveedores,
  solicitudesAprobadas,
  productosActivos,
  onGuardado,
}: OrdenDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {open && (
          <OrdenForm
            proveedores={proveedores}
            solicitudesAprobadas={solicitudesAprobadas}
            productosActivos={productosActivos}
            onOpenChange={onOpenChange}
            onGuardado={onGuardado}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function OrdenForm({
  proveedores,
  solicitudesAprobadas,
  productosActivos,
  onOpenChange,
  onGuardado,
}: {
  proveedores: Proveedor[]
  solicitudesAprobadas: SolicitudCompra[]
  productosActivos: ProductoServicio[]
  onOpenChange: (open: boolean) => void
  onGuardado: () => void
}) {
  const [proveedorId, setProveedorId] = useState('')
  const [fecha, setFecha] = useState('')
  const [solicitudIds, setSolicitudIds] = useState<string[]>([])
  const [lineas, setLineas] = useState<LineaDetalle[]>([{ productoId: '', cantidad: '' }])
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lineasCompletas = lineas.filter(
    (linea) => linea.productoId !== '' && Number(linea.cantidad) > 0,
  )
  // El backend rechaza ítems repetidos en el detalle (habría que sumar las cantidades en una
  // sola línea): se avisa acá antes de mandar, en vez de esperar el 422.
  const hayProductoRepetido =
    new Set(lineasCompletas.map((linea) => linea.productoId)).size !== lineasCompletas.length

  const puedeEnviar =
    proveedorId !== '' &&
    solicitudIds.length > 0 &&
    lineasCompletas.length > 0 &&
    !hayProductoRepetido

  function alternarSolicitud(solicitudId: string) {
    setSolicitudIds((actuales) =>
      actuales.includes(solicitudId)
        ? actuales.filter((id) => id !== solicitudId)
        : [...actuales, solicitudId],
    )
  }

  function actualizarLinea(indice: number, cambios: Partial<LineaDetalle>) {
    setLineas((actuales) =>
      actuales.map((linea, i) => (i === indice ? { ...linea, ...cambios } : linea)),
    )
  }

  async function handleSubmit(evento: React.FormEvent) {
    evento.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      await crearOrden({
        proveedor_id: proveedorId,
        fecha: fecha || null,
        solicitud_ids: solicitudIds,
        detalles: lineasCompletas.map((linea) => ({
          producto_servicio_id: linea.productoId,
          cantidad_pedida: linea.cantidad,
        })),
      })
      onGuardado()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudo emitir la orden.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Nueva orden de compra</DialogTitle>
        <DialogDescription>
          Las solicitudes dicen por qué se compra y quedan vinculadas para la trazabilidad; el
          detalle dice qué se le pide al proveedor. Una orden puede agrupar varias solicitudes.
        </DialogDescription>
      </DialogHeader>

      {error && (
        <Alert variant="error" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="mt-4 flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="orden-proveedor">Proveedor</FieldLabel>
          <div className="relative">
            <TruckIcon
              className="text-texto-3 pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Select value={proveedorId} onValueChange={setProveedorId}>
              <SelectTrigger id="orden-proveedor" className="w-full pl-9">
                <SelectValue placeholder="Elegí un proveedor" />
              </SelectTrigger>
              <SelectContent>
                {proveedores.map((proveedor) => (
                  <SelectItem key={proveedor.id} value={proveedor.id}>
                    {proveedor.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Field>

        <Field>
          <FieldLabel htmlFor="orden-fecha">Fecha de emisión (opcional)</FieldLabel>
          <div className="relative">
            <CalendarIcon
              className="text-texto-3 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              id="orden-fecha"
              type="date"
              value={fecha}
              onChange={(evento) => setFecha(evento.target.value)}
              className="pl-9"
            />
          </div>
        </Field>

        <Field>
          <FieldLabel>Solicitudes aprobadas que origina esta orden</FieldLabel>
          {solicitudesAprobadas.length === 0 ? (
            <p className="text-texto-2 text-sm">
              No hay solicitudes aprobadas disponibles. Aprobá alguna en Solicitudes de compra, o
              revisá si ya están incluidas en otra orden.
            </p>
          ) : (
            <ScrollArea className="border-borde max-h-44 rounded-panel border p-2">
              <div className="flex flex-col gap-2">
                {solicitudesAprobadas.map((solicitud) => (
                  <label
                    key={solicitud.id}
                    className="hover:bg-fila-hover flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm"
                  >
                    <Checkbox
                      checked={solicitudIds.includes(solicitud.id)}
                      onCheckedChange={() => alternarSolicitud(solicitud.id)}
                    />
                    <span className="font-medium">{descripcionSolicitud(solicitud)}</span>
                    <span className="text-texto-2">
                      · {solicitud.cantidad} · {solicitud.area_solicitante ?? 'sin área'}
                    </span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          )}
        </Field>

        <Field>
          <FieldLabel>Detalle: qué se le pide al proveedor</FieldLabel>
          {productosActivos.length === 0 ? (
            <p className="text-texto-2 text-sm">
              El catálogo está vacío. Cargá al menos un ítem en Catálogo de compras para poder armar
              el detalle.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {lineas.map((linea, indice) => (
                <div key={indice} className="flex items-center gap-2">
                  <Select
                    value={linea.productoId}
                    onValueChange={(valor) => actualizarLinea(indice, { productoId: valor })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Elegí un ítem del catálogo" />
                    </SelectTrigger>
                    <SelectContent>
                      {productosActivos.map((producto) => (
                        <SelectItem key={producto.id} value={producto.id}>
                          {producto.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    step="0.01"
                    value={linea.cantidad}
                    onChange={(evento) =>
                      actualizarLinea(indice, { cantidad: evento.target.value })
                    }
                    placeholder="Cantidad"
                    className="w-28"
                    aria-label={`Cantidad de la línea ${indice + 1}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Quitar la línea ${indice + 1}`}
                    disabled={lineas.length === 1}
                    onClick={() => setLineas((actuales) => actuales.filter((_, i) => i !== indice))}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="self-start"
                onClick={() =>
                  setLineas((actuales) => [...actuales, { productoId: '', cantidad: '' }])
                }
              >
                <PlusIcon />
                Agregar ítem
              </Button>
            </div>
          )}
        </Field>

        {hayProductoRepetido && (
          <Alert variant="error">
            <AlertDescription>
              Hay un ítem repetido en el detalle. Sumá las cantidades en una sola línea.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <DialogFooter className="mt-6">
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="submit" disabled={enviando || !puedeEnviar}>
          Emitir orden
        </Button>
      </DialogFooter>
    </form>
  )
}
