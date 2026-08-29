import { useEffect, useState } from 'react'
import { CalendarIcon, FileTextIcon } from 'lucide-react'
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
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { crearRecepcion } from '@/modules/proveedores-compras/services/crear-recepcion'
import { listarPendientesDeOrden } from '@/modules/proveedores-compras/services/listar-pendientes-orden'
import type {
  LineaPendiente,
  OrdenCompra,
  ProductoServicio,
} from '@/modules/proveedores-compras/types'

interface RecepcionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orden: OrdenCompra
  productos: ProductoServicio[]
  onRegistrada: () => void
}

export function RecepcionDialog({
  open,
  onOpenChange,
  orden,
  productos,
  onRegistrada,
}: RecepcionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {open && (
          <RecepcionForm
            orden={orden}
            productos={productos}
            onOpenChange={onOpenChange}
            onRegistrada={onRegistrada}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function RecepcionForm({
  orden,
  productos,
  onOpenChange,
  onRegistrada,
}: {
  orden: OrdenCompra
  productos: ProductoServicio[]
  onOpenChange: (open: boolean) => void
  onRegistrada: () => void
}) {
  const [pendientes, setPendientes] = useState<LineaPendiente[]>([])
  const [cargando, setCargando] = useState(true)
  const [cantidades, setCantidades] = useState<Record<string, string>>({})
  const [fecha, setFecha] = useState('')
  const [remito, setRemito] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Se piden los pendientes al abrir en vez de derivarlos de la orden que ya está en memoria:
  // entre que se cargó el listado y se abre el diálogo, otra persona pudo registrar una entrega.
  useEffect(() => {
    listarPendientesDeOrden(orden.id)
      .then((lineas) => {
        setPendientes(lineas)
        // Precargar con lo que falta es el caso habitual (llegó todo lo pendiente); quien
        // recibe menos corrige el número, que es menos trabajo que cargar todo a mano.
        setCantidades(
          Object.fromEntries(
            lineas.map((linea) => [linea.orden_compra_detalle_id, linea.cantidad_pendiente]),
          ),
        )
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.detail : 'No se pudieron cargar los pendientes.')
      })
      .finally(() => setCargando(false))
  }, [orden.id])

  const nombrePorProducto = Object.fromEntries(
    productos.map((producto) => [producto.id, producto.nombre]),
  )

  const lineasARecibir = pendientes.filter(
    (linea) => Number(cantidades[linea.orden_compra_detalle_id] ?? 0) > 0,
  )
  const hayExceso = pendientes.some(
    (linea) =>
      Number(cantidades[linea.orden_compra_detalle_id] ?? 0) > Number(linea.cantidad_pendiente),
  )
  const quedaraPendiente = pendientes.some(
    (linea) =>
      Number(linea.cantidad_pendiente) - Number(cantidades[linea.orden_compra_detalle_id] ?? 0) > 0,
  )

  async function handleSubmit(evento: React.FormEvent) {
    evento.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      await crearRecepcion(orden.id, {
        fecha: fecha || null,
        remito: remito.trim() || null,
        observaciones: observaciones.trim() || null,
        detalles: lineasARecibir.map((linea) => ({
          orden_compra_detalle_id: linea.orden_compra_detalle_id,
          cantidad_recibida: cantidades[linea.orden_compra_detalle_id],
        })),
      })
      onRegistrada()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudo registrar la recepción.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Registrar recepción</DialogTitle>
        <DialogDescription>
          Cargá lo que llegó de cada ítem. Si recibís menos de lo pedido, el resto queda pendiente
          automáticamente y podés registrar otra entrega más adelante.
        </DialogDescription>
      </DialogHeader>

      {error && (
        <Alert variant="error" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {cargando ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <Field>
            <FieldLabel>Ítems de la orden</FieldLabel>
            <div className="flex flex-col gap-2">
              {pendientes.map((linea) => (
                <div key={linea.orden_compra_detalle_id} className="flex items-center gap-3">
                  <span className="flex-1 text-sm font-medium">
                    {nombrePorProducto[linea.producto_servicio_id] ?? 'Ítem del catálogo'}
                  </span>
                  <span className="text-texto-2 text-xs tabular-nums">
                    pedido {linea.cantidad_pedida} · recibido {linea.cantidad_recibida} · falta{' '}
                    {linea.cantidad_pendiente}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={Number(linea.cantidad_pendiente)}
                    step="0.01"
                    value={cantidades[linea.orden_compra_detalle_id] ?? ''}
                    onChange={(evento) =>
                      setCantidades((actuales) => ({
                        ...actuales,
                        [linea.orden_compra_detalle_id]: evento.target.value,
                      }))
                    }
                    className="w-28"
                    aria-label={`Cantidad recibida de ${
                      nombrePorProducto[linea.producto_servicio_id] ?? 'ítem'
                    }`}
                  />
                </div>
              ))}
            </div>
          </Field>

          <Field>
            <FieldLabel htmlFor="recepcion-fecha">Fecha de recepción (opcional)</FieldLabel>
            <div className="relative">
              <CalendarIcon
                className="text-texto-3 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                aria-hidden
              />
              <Input
                id="recepcion-fecha"
                type="date"
                value={fecha}
                onChange={(evento) => setFecha(evento.target.value)}
                className="pl-9"
              />
            </div>
          </Field>

          <Field>
            <FieldLabel htmlFor="recepcion-remito">Remito (opcional)</FieldLabel>
            <div className="relative">
              <FileTextIcon
                className="text-texto-3 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                aria-hidden
              />
              <Input
                id="recepcion-remito"
                value={remito}
                onChange={(evento) => setRemito(evento.target.value)}
                placeholder="ej. R-0001-00012345"
                className="pl-9"
              />
            </div>
          </Field>

          <Field>
            <FieldLabel htmlFor="recepcion-observaciones">Observaciones (opcional)</FieldLabel>
            <Textarea
              id="recepcion-observaciones"
              value={observaciones}
              onChange={(evento) => setObservaciones(evento.target.value)}
              placeholder="Diferencias, faltantes o cualquier detalle de la entrega"
              rows={3}
            />
          </Field>

          {hayExceso && (
            <Alert variant="error">
              <AlertDescription>
                Estás cargando más de lo que falta en alguna línea. Revisá las cantidades.
              </AlertDescription>
            </Alert>
          )}

          {!hayExceso && lineasARecibir.length > 0 && (
            <p className="text-texto-2 text-sm">
              {quedaraPendiente
                ? 'Queda saldo pendiente: la orden sigue abierta para otra entrega.'
                : 'Con esta entrega se completa la orden, que pasa a Recibida.'}
            </p>
          )}
        </div>
      )}

      <DialogFooter className="mt-6">
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={enviando || cargando || lineasARecibir.length === 0 || hayExceso}
        >
          Registrar recepción
        </Button>
      </DialogFooter>
    </form>
  )
}
