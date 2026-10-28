import { useEffect, useState } from 'react'
import { DownloadIcon, ReceiptTextIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { descargarComprobantePagoFamilia } from '@/modules/facturacion/services/descargar-comprobante-pago-familia'
import { listarFacturacionFamilia } from '@/modules/facturacion/services/listar-facturacion-familia'
import type { EstadoFactura, FacturacionFamilia, PagoFamilia } from '@/modules/facturacion/types'

const FORMATEADOR_MONEDA = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
})
const FORMATEADOR_FECHA = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
})

type ResultadoConsultaFacturacion =
  | { intento: number; estado: 'exito'; cuenta: FacturacionFamilia }
  | { intento: number; estado: 'error' }

const ESTADOS_FACTURA: Record<
  EstadoFactura,
  { etiqueta: string; variante: 'advertencia' | 'error' | 'exito' }
> = {
  pendiente: { etiqueta: 'Pendiente', variante: 'advertencia' },
  vencida: { etiqueta: 'Vencida', variante: 'error' },
  pagada: { etiqueta: 'Pagada', variante: 'exito' },
}

const ESTADOS_PAGO: Record<
  PagoFamilia['estado'],
  { etiqueta: string; variante: 'advertencia' | 'error' | 'exito' }
> = {
  aprobado: { etiqueta: 'Aprobado', variante: 'exito' },
  pendiente: { etiqueta: 'En revisión', variante: 'advertencia' },
  rechazado: { etiqueta: 'Rechazado', variante: 'error' },
}

function formatearMoneda(monto: string) {
  return FORMATEADOR_MONEDA.format(Number(monto))
}

function formatearFecha(fecha: string) {
  const fechaNormalizada = fecha.length === 10 ? `${fecha}T00:00:00Z` : fecha
  return FORMATEADOR_FECHA.format(new Date(fechaNormalizada))
}

function ResumenCuenta({ cuenta }: { cuenta: FacturacionFamilia }) {
  const saldo = Number(cuenta.saldo)
  return (
    <section aria-label="Resumen de cuenta" className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Cargos emitidos</CardDescription>
          <CardTitle className="text-2xl">{formatearMoneda(cuenta.total_debe)}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Pagos registrados</CardDescription>
          <CardTitle className="text-2xl">{formatearMoneda(cuenta.total_haber)}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>{saldo < 0 ? 'Saldo a favor' : 'Saldo pendiente'}</CardDescription>
          <CardTitle className="text-2xl">{formatearMoneda(String(Math.abs(saldo)))}</CardTitle>
        </CardHeader>
      </Card>
    </section>
  )
}

function EstadoPago({ pago }: { pago: PagoFamilia }) {
  const estado = ESTADOS_PAGO[pago.estado]
  return <Badge variant={estado.variante}>{estado.etiqueta}</Badge>
}

function FacturaFamiliaCard({
  factura,
  descargandoPagoId,
  alDescargar,
}: {
  factura: FacturacionFamilia['facturas'][number]
  descargandoPagoId: string | null
  alDescargar: (pagoId: string) => void
}) {
  const estado = ESTADOS_FACTURA[factura.estado]
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 border-b border-borde sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle>Factura #{factura.id.slice(0, 8)}</CardTitle>
          <CardDescription>
            {factura.alumno_nombre} · Vence {formatearFecha(factura.fecha_vencimiento)}
          </CardDescription>
        </div>
        <Badge variant={estado.variante}>{estado.etiqueta}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 pt-5">
        <ul
          className="flex flex-col gap-2"
          aria-label={`Detalle de factura ${factura.id.slice(0, 8)}`}
        >
          {factura.detalles.map((detalle, indice) => (
            <li
              key={`${factura.id}-${indice}`}
              className="flex items-start justify-between gap-4 text-sm"
            >
              <span className="text-texto-2">{detalle.descripcion}</span>
              <span className="shrink-0 font-medium text-texto">
                {formatearMoneda(detalle.monto)}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between border-t border-borde pt-4 text-sm">
          <span className="font-semibold text-texto">Total de la factura</span>
          <span className="font-semibold text-texto">{formatearMoneda(factura.monto_total)}</span>
        </div>

        {factura.pagos.length > 0 && (
          <section aria-label={`Pagos de factura ${factura.id.slice(0, 8)}`}>
            <h3 className="mb-3 text-sm font-semibold text-texto">Pagos registrados</h3>
            <ul className="flex flex-col divide-y divide-borde">
              {factura.pagos.map((pago) => (
                <li
                  key={pago.id}
                  className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-texto">
                      {formatearMoneda(pago.monto)}
                    </span>
                    <span className="text-xs text-texto-2">
                      {pago.metodo_pago === 'debito_directo'
                        ? 'Débito automático'
                        : pago.metodo_pago}{' '}
                      · {formatearFecha(pago.fecha)}
                    </span>
                    <EstadoPago pago={pago} />
                  </div>
                  {pago.comprobante_disponible && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      aria-label="Descargar comprobante"
                      disabled={descargandoPagoId === pago.id}
                      onClick={() => alDescargar(pago.id)}
                    >
                      <DownloadIcon aria-hidden="true" />
                      {descargandoPagoId === pago.id ? 'Descargando…' : 'Descargar comprobante'}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  )
}

export function PortalFamiliaFacturacionPage() {
  const [resultado, setResultado] = useState<ResultadoConsultaFacturacion | null>(null)
  const [intento, setIntento] = useState(0)
  const [descargandoPagoId, setDescargandoPagoId] = useState<string | null>(null)
  const cargando = resultado === null || resultado.intento !== intento
  const error = !cargando && resultado?.estado === 'error'
  const cuenta = !cargando && resultado?.estado === 'exito' ? resultado.cuenta : null

  useEffect(() => {
    const controller = new AbortController()
    listarFacturacionFamilia(controller.signal)
      .then((cuentaCargada) => {
        if (!controller.signal.aborted) {
          setResultado({ intento, estado: 'exito', cuenta: cuentaCargada })
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setResultado({ intento, estado: 'error' })
      })
    return () => controller.abort()
  }, [intento])

  async function descargarComprobante(pagoId: string) {
    setDescargandoPagoId(pagoId)
    try {
      await descargarComprobantePagoFamilia(pagoId)
    } catch {
      toast.error('No se pudo descargar el comprobante. Intentá de nuevo.')
    } finally {
      setDescargandoPagoId(null)
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold text-texto">Facturación</h1>
        <p className="mt-1 text-sm text-texto-2">
          Consultá las facturas, los pagos registrados y los movimientos asociados a tu cuenta.
        </p>
      </header>

      {cargando && (
        <div role="status" aria-label="Cargando facturación" className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-28 rounded-panel" />
            <Skeleton className="h-28 rounded-panel" />
            <Skeleton className="h-28 rounded-panel" />
          </div>
          <Skeleton className="h-64 rounded-panel" />
        </div>
      )}

      {error && !cargando && (
        <Empty role="alert" className="min-h-64 rounded-panel bg-superficie shadow-card">
          <EmptyMedia variant="neutral">
            <ReceiptTextIcon />
          </EmptyMedia>
          <EmptyTitle>No pudimos cargar tu facturación.</EmptyTitle>
          <EmptyDescription>Revisá tu conexión e intentá nuevamente.</EmptyDescription>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setIntento((actual) => actual + 1)}
          >
            Reintentar
          </Button>
        </Empty>
      )}

      {cuenta && !cargando && !error && (
        <div className="flex flex-col gap-6">
          <ResumenCuenta cuenta={cuenta} />

          <section aria-labelledby="facturas-familia-heading" className="flex flex-col gap-4">
            <div>
              <h2
                id="facturas-familia-heading"
                className="font-heading text-lg font-semibold text-texto"
              >
                Facturas
              </h2>
              <p className="mt-1 text-sm text-texto-2">
                Consultá los vencimientos y el detalle de cada factura emitida a tu nombre.
              </p>
            </div>
            {cuenta.facturas.length > 0 ? (
              <div className="flex flex-col gap-4">
                {cuenta.facturas.map((factura) => (
                  <FacturaFamiliaCard
                    key={factura.id}
                    factura={factura}
                    descargandoPagoId={descargandoPagoId}
                    alDescargar={(pagoId) => void descargarComprobante(pagoId)}
                  />
                ))}
              </div>
            ) : (
              <Empty className="min-h-52 rounded-panel bg-superficie shadow-card">
                <EmptyMedia variant="icon" className="bg-sup-facturacion text-mod-facturacion">
                  <ReceiptTextIcon />
                </EmptyMedia>
                <EmptyTitle>Todavía no tenés facturas.</EmptyTitle>
                <EmptyDescription>
                  Cuando se emita una factura a tu nombre, vas a poder consultarla acá.
                </EmptyDescription>
              </Empty>
            )}
          </section>

          <section aria-labelledby="movimientos-familia-heading" className="flex flex-col gap-4">
            <div>
              <h2
                id="movimientos-familia-heading"
                className="font-heading text-lg font-semibold text-texto"
              >
                Estado de cuenta
              </h2>
              <p className="mt-1 text-sm text-texto-2">
                Cargos y pagos asociados a las facturas emitidas a tu nombre.
              </p>
            </div>
            <Card>
              <CardContent className="pt-2">
                {cuenta.movimientos.length > 0 ? (
                  <ul aria-label="Movimientos de cuenta" className="divide-y divide-borde">
                    {cuenta.movimientos.map((movimiento, indice) => (
                      <li
                        key={`${movimiento.factura_id}-${movimiento.fecha}-${indice}`}
                        className="flex items-center justify-between gap-4 py-4"
                      >
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className="text-sm font-medium text-texto">
                            {movimiento.observacion ??
                              (movimiento.tipo === 'debe' ? 'Cargo de factura' : 'Pago registrado')}
                          </span>
                          <span className="text-xs text-texto-2">
                            {movimiento.tipo === 'debe' ? 'Cargo' : 'Pago'} ·{' '}
                            {formatearFecha(movimiento.fecha)}
                          </span>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-texto">
                          {formatearMoneda(movimiento.monto)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-6 text-sm text-texto-2">
                    Todavía no hay movimientos en tu cuenta.
                  </p>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      )}
    </section>
  )
}
