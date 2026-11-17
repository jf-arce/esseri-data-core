import { useState } from 'react'
import { ChevronsUpDownIcon, PlusIcon, Trash2Icon, TruckIcon } from 'lucide-react'
import { ApiError } from '@/api/client'
import { ComboboxBuscable } from '@/components/combobox-buscable'
import { DatePicker } from '@/components/date-picker'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
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
  LineaOrdenFormulario,
  OrdenCompra,
  ProductoServicio,
  Proveedor,
  SolicitudCompra,
} from '@/modules/proveedores-compras/types'
import {
  alternarSolicitudEnLineas,
  cantidadEntera,
  ETIQUETA_ESTADO_ORDEN,
  fechaAISO,
  formatearFechaDia,
  lineaOrdenVacia,
} from '@/modules/proveedores-compras/utils'

interface OrdenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proveedores: Proveedor[]
  solicitudesAprobadas: SolicitudCompra[]
  /** Orden en la que ya está cada solicitud aprobada, si está vinculada a alguna. */
  ordenPorSolicitud: Map<string, OrdenCompra>
  productos: ProductoServicio[]
  onGuardado: () => void
}

export function OrdenDialog({
  open,
  onOpenChange,
  proveedores,
  solicitudesAprobadas,
  ordenPorSolicitud,
  productos,
  onGuardado,
}: OrdenDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {open && (
          <OrdenForm
            proveedores={proveedores}
            solicitudesAprobadas={solicitudesAprobadas}
            ordenPorSolicitud={ordenPorSolicitud}
            productos={productos}
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
  ordenPorSolicitud,
  productos,
  onOpenChange,
  onGuardado,
}: {
  proveedores: Proveedor[]
  solicitudesAprobadas: SolicitudCompra[]
  ordenPorSolicitud: Map<string, OrdenCompra>
  productos: ProductoServicio[]
  onOpenChange: (open: boolean) => void
  onGuardado: () => void
}) {
  const [proveedorId, setProveedorId] = useState('')
  const [fecha, setFecha] = useState<Date | undefined>(() => new Date())
  const [solicitudIds, setSolicitudIds] = useState<string[]>([])
  const [lineas, setLineas] = useState<LineaOrdenFormulario[]>([lineaOrdenVacia()])
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const productosActivos = productos.filter((producto) => producto.activo)
  const productoPorId = new Map(productos.map((producto) => [producto.id, producto]))

  const solicitudesDisponibles = solicitudesAprobadas.filter(
    (solicitud) => !ordenPorSolicitud.has(solicitud.id),
  )
  const solicitudesUsadas = solicitudesAprobadas.filter((solicitud) =>
    ordenPorSolicitud.has(solicitud.id),
  )

  const lineasConProducto = lineas.filter((linea) => linea.productoId !== '')
  const lineasCompletas = lineasConProducto.filter(
    (linea) => cantidadEntera(linea.cantidad) !== null,
  )
  const hayCantidadInvalida = lineasConProducto.some(
    (linea) => linea.cantidad.trim() !== '' && cantidadEntera(linea.cantidad) === null,
  )
  // El backend rechaza ítems repetidos: se avisa acá antes de mandar el 422.
  const hayProductoRepetido =
    new Set(lineasConProducto.map((linea) => linea.productoId)).size !== lineasConProducto.length

  function nombreSolicitud(solicitud: SolicitudCompra): string {
    const producto = solicitud.producto_servicio_id
      ? productoPorId.get(solicitud.producto_servicio_id)
      : undefined
    return solicitud.articulo ?? producto?.nombre ?? 'Ítem de catálogo'
  }

  const solicitudesElegidas = solicitudIds
    .map((id) => solicitudesAprobadas.find((solicitud) => solicitud.id === id))
    .filter((solicitud): solicitud is SolicitudCompra => solicitud !== undefined)

  const solicitudesSinItem = solicitudesElegidas.filter(
    (solicitud) =>
      !solicitud.producto_servicio_id ||
      !productosActivos.some((producto) => producto.id === solicitud.producto_servicio_id),
  )
  // Una solicitud con ítem de catálogo puede quedar sin línea si la persona cambió el ítem de
  // esa línea o la borró: se avisa para que la cantidad no quede afuera del detalle.
  const solicitudesSinLinea = solicitudesElegidas.filter(
    (solicitud) =>
      solicitud.producto_servicio_id !== null &&
      productosActivos.some((producto) => producto.id === solicitud.producto_servicio_id) &&
      !lineas.some((linea) => linea.solicitudIds.includes(solicitud.id)),
  )

  const faltantes: string[] = []
  if (proveedorId === '') faltantes.push('Elegí un proveedor.')
  if (solicitudIds.length === 0) {
    faltantes.push('Tildá al menos una solicitud aprobada que origine la orden.')
  }
  if (lineasCompletas.length === 0) {
    faltantes.push('Agregá al menos un ítem del catálogo con su cantidad.')
  }
  if (hayCantidadInvalida) {
    faltantes.push('Las cantidades deben ser números enteros mayores a 0.')
  }
  if (lineasConProducto.length > lineasCompletas.length && !hayCantidadInvalida) {
    faltantes.push('Completá la cantidad de todas las líneas, o quitá las que sobran.')
  }
  if (hayProductoRepetido) {
    faltantes.push('Hay un ítem repetido: sumá las cantidades en una sola línea.')
  }

  const puedeEnviar = faltantes.length === 0

  function alternarSolicitud(solicitud: SolicitudCompra) {
    const tildada = !solicitudIds.includes(solicitud.id)
    setSolicitudIds((actuales) =>
      tildada ? [...actuales, solicitud.id] : actuales.filter((id) => id !== solicitud.id),
    )

    // Solo se puede mapear a una línea un ítem que exista y siga activo en el catálogo. Las de
    // texto libre (o con el ítem dado de baja) se avisan y se cargan a mano.
    const producto = solicitud.producto_servicio_id
      ? productosActivos.find((item) => item.id === solicitud.producto_servicio_id)
      : undefined
    if (tildada && producto) {
      setLineas((actuales) =>
        alternarSolicitudEnLineas(actuales, solicitud, true, solicitudesAprobadas),
      )
    } else if (!tildada) {
      setLineas((actuales) =>
        alternarSolicitudEnLineas(actuales, solicitud, false, solicitudesAprobadas),
      )
    }
  }

  function actualizarLinea(indice: number, cambios: Partial<LineaOrdenFormulario>) {
    setLineas((actuales) =>
      actuales.map((linea, i) => (i === indice ? { ...linea, ...cambios } : linea)),
    )
  }

  function cambiarProducto(indice: number, productoId: string) {
    // Cambiar el ítem desarma el aporte de las solicitudes que estaban en esa línea: la cantidad
    // que queda es la que escriba la persona. Elegir el mismo ítem no borra lo cargado.
    setLineas((actuales) =>
      actuales.map((linea, i) =>
        i !== indice || linea.productoId === productoId
          ? linea
          : { productoId, cantidad: '', solicitudIds: [], editada: false },
      ),
    )
  }

  function quitarLinea(indice: number) {
    setLineas((actuales) => {
      const restantes = actuales.filter((_, i) => i !== indice)
      return restantes.length > 0 ? restantes : [lineaOrdenVacia()]
    })
  }

  async function handleSubmit(evento: React.FormEvent) {
    evento.preventDefault()
    if (!puedeEnviar) return
    setEnviando(true)
    setError(null)
    try {
      await crearOrden({
        proveedor_id: proveedorId,
        fecha: fecha ? fechaAISO(fecha) : null,
        solicitud_ids: solicitudIds,
        detalles: lineasCompletas.map((linea) => ({
          producto_servicio_id: linea.productoId,
          cantidad_pedida: cantidadEntera(linea.cantidad) ?? 0,
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
          <FieldLabel htmlFor="orden-fecha">Fecha de emisión</FieldLabel>
          <DatePicker id="orden-fecha" value={fecha} onChange={setFecha} placeholder="dd/mm/aaaa" />
          <FieldDescription>Si no la cambiás, se emite con la fecha de hoy.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel>Solicitudes aprobadas que origina esta orden</FieldLabel>
          {solicitudesAprobadas.length === 0 ? (
            <p className="text-texto-2 text-sm">
              No hay solicitudes aprobadas todavía. Aprobá alguna en Solicitudes de compra para
              poder emitir una orden.
            </p>
          ) : solicitudesDisponibles.length === 0 ? (
            <p className="text-texto-2 text-sm">
              Las {solicitudesAprobadas.length} solicitudes aprobadas ya están vinculadas a una
              orden, y una solicitud no se puede usar dos veces. Aprobá una solicitud nueva para
              emitir otra orden. Las que ya están en uso son:
            </p>
          ) : (
            <ScrollArea className="border-borde max-h-44 rounded-panel border p-2">
              <div className="flex flex-col gap-2">
                {solicitudesDisponibles.map((solicitud) => (
                  <label
                    key={solicitud.id}
                    className="hover:bg-fila-hover flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm"
                  >
                    <Checkbox
                      checked={solicitudIds.includes(solicitud.id)}
                      onCheckedChange={() => alternarSolicitud(solicitud)}
                    />
                    <span className="font-medium">{nombreSolicitud(solicitud)}</span>
                    <span className="text-texto-2">
                      · {solicitud.cantidad} · {solicitud.area_solicitante ?? 'sin área'} ·{' '}
                      {formatearFechaDia(solicitud.fecha)}
                    </span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          )}

          {solicitudesUsadas.length > 0 && (
            <div className="text-texto-2 mt-2 flex flex-col gap-1 text-xs">
              <p className="font-medium">Ya vinculadas a una orden (no se pueden reutilizar):</p>
              <ul className="flex flex-col gap-0.5">
                {solicitudesUsadas.map((solicitud) => {
                  const orden = ordenPorSolicitud.get(solicitud.id)
                  return (
                    <li key={solicitud.id} className="truncate">
                      · {nombreSolicitud(solicitud)} · {solicitud.cantidad} ·{' '}
                      {orden
                        ? `orden del ${formatearFechaDia(orden.fecha)} (${ETIQUETA_ESTADO_ORDEN[orden.estado]})`
                        : 'orden sin datos'}
                    </li>
                  )
                })}
              </ul>
            </div>
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
              {lineas.map((linea, indice) => {
                const producto = productoPorId.get(linea.productoId)
                const usadosEnOtrasLineas = new Set(
                  lineas
                    .filter((otra, i) => i !== indice && otra.productoId !== '')
                    .map((otra) => otra.productoId),
                )
                const opciones = productosActivos
                  .filter((item) => !usadosEnOtrasLineas.has(item.id))
                  .map((item) => ({
                    valor: item.id,
                    etiqueta: item.nombre,
                    detalle: [item.categoria, item.unidad].filter(Boolean).join(' · ') || undefined,
                  }))

                return (
                  <div key={indice} className="flex items-center gap-2">
                    <ComboboxBuscable
                      opciones={opciones}
                      valor={linea.productoId || null}
                      onElegir={(valor) => cambiarProducto(indice, valor)}
                    >
                      <Button
                        type="button"
                        variant="secondary"
                        role="combobox"
                        className="min-w-0 flex-1 justify-between font-normal"
                      >
                        <span className={producto ? 'truncate' : 'text-desactivado truncate'}>
                          {producto?.nombre ?? 'Elegí un ítem del catálogo'}
                        </span>
                        <ChevronsUpDownIcon />
                      </Button>
                    </ComboboxBuscable>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      value={linea.cantidad}
                      onChange={(evento) =>
                        actualizarLinea(indice, { cantidad: evento.target.value, editada: true })
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
                      onClick={() => quitarLinea(indice)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                )
              })}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="self-start"
                onClick={() => setLineas((actuales) => [...actuales, lineaOrdenVacia()])}
              >
                <PlusIcon />
                Agregar ítem
              </Button>
            </div>
          )}
        </Field>

        {solicitudesSinItem.length > 0 && (
          <Alert variant="advertencia">
            <AlertTitle>Hay solicitudes sin ítem de catálogo</AlertTitle>
            <AlertDescription>
              {solicitudesSinItem.map(nombreSolicitud).join(', ')}. No se pueden agregar
              automáticamente al detalle: cargá el ítem y la cantidad a mano.
            </AlertDescription>
          </Alert>
        )}

        {solicitudesSinLinea.length > 0 && (
          <Alert variant="advertencia">
            <AlertTitle>Hay solicitudes que no están en el detalle</AlertTitle>
            <AlertDescription>
              {solicitudesSinLinea.map(nombreSolicitud).join(', ')}. Volvé a tildarlas o revisá el
              ítem de la línea para que su cantidad cuente.
            </AlertDescription>
          </Alert>
        )}

        {faltantes.length > 0 && (
          <Alert variant="advertencia">
            <AlertTitle>Para emitir la orden falta:</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5">
                {faltantes.map((faltante) => (
                  <li key={faltante}>{faltante}</li>
                ))}
              </ul>
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
