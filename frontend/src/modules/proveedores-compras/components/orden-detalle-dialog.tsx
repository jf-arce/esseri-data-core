import { useEffect, useState } from 'react'
import { PackageSearchIcon } from 'lucide-react'
import { ApiError } from '@/api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { obtenerOrden } from '@/modules/proveedores-compras/services/obtener-orden'
import type {
  EstadoOrdenCompra,
  OrdenCompra,
  ProductoServicio,
  Proveedor,
  SolicitudCompra,
} from '@/modules/proveedores-compras/types'
import { ETIQUETA_ESTADO_ORDEN, formatearFechaDia } from '@/modules/proveedores-compras/utils'

const VARIANTE_POR_ESTADO: Record<EstadoOrdenCompra, 'exito' | 'info' | 'neutro'> = {
  emitida: 'info',
  recibida: 'exito',
  cancelada: 'neutro',
}

interface OrdenDetalleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ordenId: string | null
  productos: ProductoServicio[]
  solicitudes: SolicitudCompra[]
  proveedores: Proveedor[]
}

/**
 * Detalle de una orden: qué ítems y cantidades se le pidieron al proveedor y qué solicitudes
 * aprobadas la originaron. El listado paginado solo trae los totales, así que el detalle se pide
 * aparte a `GET /ordenes/{id}`.
 */
export function OrdenDetalleDialog({
  open,
  onOpenChange,
  ordenId,
  productos,
  solicitudes,
  proveedores,
}: OrdenDetalleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        {open && ordenId && (
          <ContenidoDetalle
            ordenId={ordenId}
            productos={productos}
            solicitudes={solicitudes}
            proveedores={proveedores}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ContenidoDetalle({
  ordenId,
  productos,
  solicitudes,
  proveedores,
}: {
  ordenId: string
  productos: ProductoServicio[]
  solicitudes: SolicitudCompra[]
  proveedores: Proveedor[]
}) {
  const [orden, setOrden] = useState<OrdenCompra | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    obtenerOrden(ordenId, controller.signal)
      .then((datos) => setOrden(datos))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof ApiError ? err.detail : 'No se pudo cargar el detalle de la orden.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargando(false)
      })

    return () => controller.abort()
  }, [ordenId])

  const productoPorId = new Map(productos.map((producto) => [producto.id, producto]))
  const solicitudPorId = new Map(solicitudes.map((solicitud) => [solicitud.id, solicitud]))
  const nombreSolicitud = (solicitud: SolicitudCompra) =>
    solicitud.articulo ??
    (solicitud.producto_servicio_id
      ? productoPorId.get(solicitud.producto_servicio_id)?.nombre
      : undefined) ??
    'Ítem de catálogo'
  const proveedor = orden ? proveedores.find((item) => item.id === orden.proveedor_id) : undefined

  const unidades =
    orden?.detalles.reduce((total, detalle) => total + Number(detalle.cantidad_pedida), 0) ?? 0

  return (
    <>
      <DialogHeader>
        <DialogTitle>Detalle de la orden</DialogTitle>
        <DialogDescription>
          {orden
            ? `${proveedor?.nombre ?? 'Proveedor'} · ${formatearFechaDia(orden.fecha)} · ${ETIQUETA_ESTADO_ORDEN[orden.estado]}`
            : 'Ítems pedidos y solicitudes que originaron la orden.'}
        </DialogDescription>
      </DialogHeader>

      {cargando ? (
        <div className="text-texto-2 flex items-center justify-center gap-2 py-12 text-sm">
          <Spinner />
          Cargando el detalle…
        </div>
      ) : error ? (
        <Alert variant="error" className="mt-4">
          <AlertTitle>No se pudo cargar el detalle</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : orden ? (
        <ScrollArea className="mt-4 max-h-[65vh] pr-3">
          <div className="flex flex-col gap-5">
            <section className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Ítems pedidos</h3>
                <div className="text-texto-2 flex items-center gap-2 text-xs">
                  <Badge variant={VARIANTE_POR_ESTADO[orden.estado]}>
                    {ETIQUETA_ESTADO_ORDEN[orden.estado]}
                  </Badge>
                  <span className="tabular-nums">
                    {orden.detalles.length} {orden.detalles.length === 1 ? 'ítem' : 'ítems'} ·{' '}
                    {unidades} {unidades === 1 ? 'unidad' : 'unidades'}
                  </span>
                </div>
              </div>

              {orden.detalles.length === 0 ? (
                <p className="text-texto-2 flex items-center gap-2 text-sm">
                  <PackageSearchIcon className="size-4" aria-hidden />
                  La orden no tiene ítems cargados.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ítem</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Unidad</TableHead>
                      <TableHead data-align="end">Cantidad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orden.detalles.map((detalle) => {
                      const producto = productoPorId.get(detalle.producto_servicio_id)
                      return (
                        <TableRow key={detalle.id}>
                          <TableCell className="font-medium">
                            {producto?.nombre ?? 'Ítem del catálogo'}
                          </TableCell>
                          <TableCell className="text-texto-2">
                            {producto?.categoria ?? '—'}
                          </TableCell>
                          <TableCell className="text-texto-2">{producto?.unidad ?? '—'}</TableCell>
                          <TableCell data-align="end" className="tabular-nums">
                            {Number(detalle.cantidad_pedida)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">Solicitudes de origen</h3>
              {orden.solicitud_ids.length === 0 ? (
                <p className="text-texto-2 text-sm">La orden no tiene solicitudes vinculadas.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Solicitud</TableHead>
                      <TableHead>Área solicitante</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead data-align="end">Cantidad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orden.solicitud_ids.map((solicitudId) => {
                      const solicitud = solicitudPorId.get(solicitudId)
                      return (
                        <TableRow key={solicitudId}>
                          <TableCell className="font-medium">
                            {solicitud ? nombreSolicitud(solicitud) : 'Solicitud no cargada'}
                          </TableCell>
                          <TableCell className="text-texto-2">
                            {solicitud?.area_solicitante ?? '—'}
                          </TableCell>
                          <TableCell className="text-texto-2 tabular-nums">
                            {solicitud ? formatearFechaDia(solicitud.fecha) : '—'}
                          </TableCell>
                          <TableCell data-align="end" className="tabular-nums">
                            {solicitud ? solicitud.cantidad : '—'}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </section>
          </div>
        </ScrollArea>
      ) : null}
    </>
  )
}
