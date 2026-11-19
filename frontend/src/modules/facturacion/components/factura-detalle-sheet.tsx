import { DownloadIcon, ExternalLinkIcon } from 'lucide-react'
import { Link } from 'react-router'
import { descargarExport } from '@/lib/descargar-export'
import { formatearFechaHora } from '@/lib/fechas'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useFacturaDetalle } from '@/modules/facturacion/hooks/use-factura-detalle'
import {
  etiquetaEstadoFactura,
  etiquetaMetodoPago,
  formatearFechaFactura,
  formatearMoneda,
} from '@/modules/facturacion/utils'

const VARIANTE_ESTADO = { pendiente: 'advertencia', vencida: 'error', pagada: 'exito' } as const

interface FacturaDetalleSheetProps {
  facturaId: string | null
  numero: string | null
  onOpenChange: (open: boolean) => void
}

export function FacturaDetalleSheet({ facturaId, numero, onOpenChange }: FacturaDetalleSheetProps) {
  const { factura, cargando, error, sinPermiso } = useFacturaDetalle(facturaId ?? undefined)

  function descargarPdf() {
    if (!factura) return
    descargarExport(
      `/facturacion/facturas/${factura.id}/pdf`,
      `factura-${factura.id.slice(0, 8)}.pdf`,
    ).catch(() => undefined)
  }

  return (
    <Sheet open={Boolean(facturaId)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{numero ? `Factura ${numero}` : 'Detalle de factura'}</SheetTitle>
          <SheetDescription>Datos, conceptos y pagos registrados.</SheetDescription>
        </SheetHeader>

        {cargando && <Skeleton className="mx-4 h-64 rounded-panel" />}

        {(sinPermiso || error) && (
          <p className="px-4 text-sm text-texto-2">
            {sinPermiso ? 'No tenés permiso para ver esta factura.' : error}
          </p>
        )}

        {factura && (
          <div className="flex flex-col gap-5 px-4">
            <div className="flex items-center justify-between gap-3">
              <Badge variant={VARIANTE_ESTADO[factura.estado]}>
                {etiquetaEstadoFactura(factura.estado)}
              </Badge>
              <p className="text-xl font-semibold tabular-nums text-texto">
                {formatearMoneda(factura.monto_total)}
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div className="col-span-2">
                <dt className="text-texto-3">Alumno</dt>
                <dd className="font-medium text-texto">
                  {factura.alumno_nombre} · {factura.alumno_legajo}
                </dd>
              </div>
              <div>
                <dt className="text-texto-3">Emisión</dt>
                <dd className="font-medium text-texto">
                  {formatearFechaFactura(factura.fecha_emision)}
                </dd>
              </div>
              <div>
                <dt className="text-texto-3">Vencimiento</dt>
                <dd className="font-medium text-texto">
                  {formatearFechaFactura(factura.fecha_vencimiento)}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-texto-3">Responsable económico</dt>
                <dd className="font-medium text-texto">
                  {factura.responsable_economico_nombre ?? 'Sin responsable asignado'}
                </dd>
              </div>
            </dl>

            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-texto">Conceptos</h3>
              <div className="flex flex-col divide-y divide-borde rounded-panel border border-borde">
                {factura.detalles.map((detalle) => (
                  <div
                    key={detalle.id}
                    className="flex items-center justify-between gap-4 px-3 py-2 text-sm"
                  >
                    <span>{detalle.descripcion}</span>
                    <strong className="tabular-nums">{formatearMoneda(detalle.monto)}</strong>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-4 bg-texto px-3 py-2 text-sm font-semibold text-superficie">
                  <span>Total</span>
                  <strong className="tabular-nums">{formatearMoneda(factura.monto_total)}</strong>
                </div>
              </div>
            </section>

            {factura.recargos.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-texto">Recargos por mora</h3>
                <div className="flex flex-col divide-y divide-borde rounded-panel border border-borde">
                  {factura.recargos.map((recargo) => (
                    <div
                      key={recargo.id}
                      className="flex items-center justify-between gap-4 px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium text-texto">
                          {recargo.observacion ?? 'Recargo por mora'}
                        </p>
                        <p className="text-xs text-texto-3">{formatearFechaHora(recargo.fecha)}</p>
                      </div>
                      <strong className="tabular-nums text-error">
                        {formatearMoneda(recargo.monto)}
                      </strong>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-texto">Pagos registrados</h3>
              {factura.pagos.length === 0 ? (
                <p className="text-sm text-texto-2">Sin pagos registrados sobre esta factura.</p>
              ) : (
                <div className="flex flex-col divide-y divide-borde rounded-panel border border-borde">
                  {factura.pagos.map((pago) => (
                    <div
                      key={pago.id}
                      className="flex items-center justify-between gap-4 px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium text-texto">
                          {etiquetaMetodoPago(pago.metodo_pago.nombre)} ·{' '}
                          {formatearFechaFactura(pago.fecha)}
                        </p>
                        <p className="text-xs text-texto-3">
                          {pago.comprobante ??
                            pago.referencia_transaccion ??
                            'Sin referencia adicional'}
                        </p>
                      </div>
                      <strong className="tabular-nums">{formatearMoneda(pago.monto)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        <SheetFooter className="flex-row flex-wrap">
          <Button asChild variant="secondary" className="flex-1">
            <Link to={`/facturacion/${facturaId ?? ''}`}>
              <ExternalLinkIcon data-icon="inline-start" />
              Ver factura completa
            </Link>
          </Button>
          <Button className="flex-1" disabled={!factura} onClick={descargarPdf}>
            <DownloadIcon data-icon="inline-start" />
            Descargar PDF
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
