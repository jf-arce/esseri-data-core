import { DownloadIcon, ShieldAlertIcon } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { descargarExport } from '@/lib/descargar-export'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { FormularioPagoFactura } from '@/modules/facturacion/components/formulario-pago-factura'
import { useFacturaDetalle } from '@/modules/facturacion/hooks/use-factura-detalle'
import {
  etiquetaEstadoFactura,
  formatearFechaFactura,
  formatearMoneda,
} from '@/modules/facturacion/utils'

const VARIANTE_ESTADO = { pendiente: 'advertencia', vencida: 'error', pagada: 'exito' } as const

export function FacturaDetallePage() {
  const { facturaId } = useParams()
  const { factura, cargando, error, sinPermiso, recargar } = useFacturaDetalle(facturaId)

  if (cargando) {
    return <Skeleton className="h-120 w-full rounded-panel" />
  }
  if (sinPermiso || !factura) {
    return (
      <Empty className="min-h-[420px] rounded-panel bg-superficie shadow-card">
        <EmptyMedia variant="neutral">
          <ShieldAlertIcon />
        </EmptyMedia>
        <EmptyTitle>
          {sinPermiso ? 'No tenés permiso para ver esta factura.' : 'No encontramos la factura.'}
        </EmptyTitle>
        <EmptyDescription>
          {error ?? 'Volvé al listado de facturas para continuar.'}
        </EmptyDescription>
        <Button variant="secondary" asChild>
          <Link to="/facturacion">Volver a facturas</Link>
        </Button>
      </Empty>
    )
  }

  const descargarPdf = () => {
    descargarExport(
      `/facturacion/facturas/${factura.id}/pdf`,
      `factura-${factura.id.slice(0, 8)}.pdf`,
    ).catch(() => undefined)
  }

  const descargarComprobante = (pagoId: string, nombre: string) => {
    descargarExport(`/facturacion/pagos/${pagoId}/comprobante`, nombre).catch(() => undefined)
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 py-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/facturacion">Facturación</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Factura #{factura.id.slice(0, 8)}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-bold tracking-widest text-texto-3 uppercase">
            Facturación y cobranza
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-texto">
            Factura #{factura.id.slice(0, 8)}
          </h1>
        </div>
        <Button variant="secondary" onClick={descargarPdf}>
          <DownloadIcon data-icon="inline-start" /> Descargar PDF
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.9fr)] lg:items-start">
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader className="border-b border-borde">
              <CardTitle>Datos de la factura</CardTitle>
              <CardAction>
                <Badge variant={VARIANTE_ESTADO[factura.estado]}>
                  {etiquetaEstadoFactura(factura.estado)}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                <div>
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
                <div>
                  <dt className="text-texto-3">Responsable económico</dt>
                  <dd className="font-medium text-texto">
                    {factura.responsable_economico_nombre ?? 'Sin responsable asignado'}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-borde">
              <CardTitle>Conceptos</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <div className="flex flex-col">
                {factura.detalles.map((detalle) => (
                  <div
                    key={detalle.id}
                    className="flex items-center justify-between gap-4 px-5 py-3 text-sm"
                  >
                    <span>{detalle.descripcion}</span>
                    <strong className="tabular-nums">{formatearMoneda(detalle.monto)}</strong>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-4 bg-texto px-5 py-4 text-sm font-semibold text-superficie">
                  <span>Total</span>
                  <strong className="tabular-nums">{formatearMoneda(factura.monto_total)}</strong>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-borde">
              <CardTitle>Pagos registrados</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {factura.pagos.length === 0 ? (
                <p className="px-5 text-sm text-texto-2">
                  Sin pagos registrados sobre esta factura.
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-borde">
                  {factura.pagos.map((pago) => (
                    <div
                      key={pago.id}
                      className="flex flex-col gap-2 px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium text-texto">
                          {pago.metodo_pago.nombre} · {formatearFechaFactura(pago.fecha)}
                        </p>
                        <p className="text-xs text-texto-3">
                          {pago.comprobante ??
                            pago.referencia_transaccion ??
                            'Sin referencia adicional'}
                        </p>
                        {pago.registrado_por && (
                          <p className="text-xs text-texto-3">
                            Registrado por {pago.registrado_por}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {pago.comprobante && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              descargarComprobante(pago.id, pago.comprobante ?? 'comprobante')
                            }
                          >
                            <DownloadIcon data-icon="inline-start" /> Comprobante
                          </Button>
                        )}
                        <strong className="tabular-nums">{formatearMoneda(pago.monto)}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="border-b border-borde">
            <CardTitle>Registrar pago</CardTitle>
          </CardHeader>
          <CardContent>
            <FormularioPagoFactura factura={factura} onPagoRegistrado={recargar} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
