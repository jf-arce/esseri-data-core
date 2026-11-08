import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  ChevronDownIcon,
  CircleDollarSignIcon,
  DownloadIcon,
  ReceiptTextIcon,
  Share2Icon,
  WalletIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { descargarComprobantePagoFamilia } from '@/modules/facturacion/services/descargar-comprobante-pago-familia'
import { listarFacturacionFamilia } from '@/modules/facturacion/services/listar-facturacion-familia'
import {
  compartirFacturaFamilia,
  descargarFacturaFamilia,
} from '@/modules/facturacion/services/factura-pdf-familia'
import type {
  EstadoFactura,
  FacturaFamilia,
  FacturacionFamilia,
  PagoFamilia,
} from '@/modules/facturacion/types'

const FORMATEADOR_MONEDA = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  trailingZeroDisplay: 'stripIfInteger',
})
const FORMATEADOR_FECHA = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: 'short',
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
  aprobado: { etiqueta: 'Acreditado', variante: 'exito' },
  pendiente: { etiqueta: 'En revisión', variante: 'advertencia' },
  rechazado: { etiqueta: 'Rechazado', variante: 'error' },
}

const TEXTOS_DEBITO = {
  aviso: 'Las cuotas se debitan automáticamente de tu medio de pago adherido.',
  vencida: 'No pudimos acreditar el débito. Escribinos desde',
  rechazado: 'Débito rechazado',
  registrados: 'Débitos acreditados',
  medio: (metodo: string) => (metodo === 'debito_directo' ? 'Débito automático' : metodo),
  programado: (dias: number, fecha: string) =>
    dias === 0
      ? 'Se debita hoy'
      : dias === 1
        ? 'Se debita mañana'
        : `Se debita el ${formatearFecha(fecha)}`,
}

function formatearMoneda(monto: string) {
  return FORMATEADOR_MONEDA.format(Number(monto))
}

function formatearFecha(fecha: string) {
  const fechaNormalizada = fecha.length === 10 ? `${fecha}T00:00:00Z` : fecha
  const partes = FORMATEADOR_FECHA.formatToParts(new Date(fechaNormalizada))
  return ['day', 'month', 'year']
    .map((tipo) => partes.find((parte) => parte.type === tipo)?.value.replace(/\./g, ''))
    .join(' ')
}

function diasParaVencer(fecha: string) {
  const hoy = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  return Math.round((Date.parse(`${fecha}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / 86400000)
}

/** Fallback for a payload from an older backend that omits the effective due date. */
function vencimiento(factura: FacturaFamilia): string {
  return factura.fecha_vencimiento_efectiva || factura.fecha_vencimiento || ''
}

function estadoVisible(factura: FacturaFamilia): EstadoFactura {
  if (factura.estado === 'pagada') return 'pagada'
  return diasParaVencer(vencimiento(factura)) < 0 ? 'vencida' : 'pendiente'
}

function ResumenCuenta({ cuenta }: { cuenta: FacturacionFamilia }) {
  const saldo = Number(cuenta.saldo)
  const pendientes = cuenta.facturas
    .filter((factura) => estadoVisible(factura) === 'pendiente')
    .sort((a, b) => vencimiento(a).localeCompare(vencimiento(b)))
  const proxima = pendientes[0]
  const vencidas = cuenta.facturas.filter((factura) => estadoVisible(factura) === 'vencida')
  const totalVencido = vencidas.reduce(
    (suma, factura) => suma + Math.round(Number(factura.monto_total) * 100),
    0,
  )
  return (
    <section aria-label="Resumen de cuenta" className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <ReceiptTextIcon aria-hidden="true" className="size-4" /> Cargos emitidos
          </CardDescription>
          <CardTitle className="text-2xl">{formatearMoneda(cuenta.total_debe)}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <CircleDollarSignIcon aria-hidden="true" className="size-4" />{' '}
            {TEXTOS_DEBITO.registrados}
          </CardDescription>
          <CardTitle className="text-2xl">{formatearMoneda(cuenta.total_haber)}</CardTitle>
        </CardHeader>
      </Card>
      <Card
        className={saldo > 0 ? 'border border-mod-facturacion/30 bg-sup-facturacion' : undefined}
      >
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <WalletIcon aria-hidden="true" className="size-4" />
            {saldo < 0 ? 'Saldo a favor' : 'Saldo pendiente'}
          </CardDescription>
          <CardTitle className="text-2xl">{formatearMoneda(String(Math.abs(saldo)))}</CardTitle>
          {proxima && (
            <p className="text-[13px] text-texto-2">
              Próximo débito:{' '}
              {diasParaVencer(vencimiento(proxima)) === 0
                ? 'hoy'
                : diasParaVencer(vencimiento(proxima)) === 1
                  ? 'mañana'
                  : formatearFecha(vencimiento(proxima))}{' '}
              · {formatearMoneda(proxima.monto_total)}
            </p>
          )}
          {vencidas.length > 0 && (
            <p className="text-[13px] font-medium text-error">
              {formatearMoneda(String(totalVencido / 100))} vencido
            </p>
          )}
        </CardHeader>
      </Card>
    </section>
  )
}

function EstadoPago({ pago }: { pago: PagoFamilia }) {
  const estado = ESTADOS_PAGO[pago.estado]
  return (
    <Badge variant={estado.variante} className={colorAccesible(estado.variante)}>
      {estado.etiqueta}
    </Badge>
  )
}

function colorAccesible(variante: 'advertencia' | 'error' | 'exito') {
  if (variante === 'advertencia') return 'text-[#873b08] [.dark_&]:text-advertencia'
  if (variante === 'exito') return 'text-[#09613e] [.dark_&]:text-exito'
  return undefined
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
  const [abierta, setAbierta] = useState(false)
  const estadoActual = estadoVisible(factura)
  const estado = ESTADOS_FACTURA[estadoActual]
  const dias = diasParaVencer(vencimiento(factura))
  const ultimoDebito = factura.pagos
    .filter((pago) => pago.metodo_pago === 'debito_directo')
    .slice()
    .sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
  const rechazado = estadoActual !== 'pagada' && ultimoDebito?.estado === 'rechazado'
  const concepto =
    factura.detalles[0]?.descripcion?.trim() ||
    `Cuota ${formatearFecha(vencimiento(factura)).split(' ').slice(1).join(' ')}`
  return (
    <Card className="py-0">
      <details onToggle={(evento) => setAbierta(evento.currentTarget.open)}>
        <summary
          aria-expanded={abierta}
          className="cursor-pointer list-none focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
        >
          <CardHeader className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <CardTitle>{concepto}</CardTitle>
              <CardDescription>
                {factura.alumno_nombre} ·{' '}
                {estadoActual === 'pendiente'
                  ? TEXTOS_DEBITO.programado(dias, vencimiento(factura))
                  : `Vence ${formatearFecha(vencimiento(factura))}`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-texto">
                {formatearMoneda(factura.monto_total)}
              </span>
              <Badge
                variant={rechazado ? 'error' : estado.variante}
                className={rechazado ? undefined : colorAccesible(estado.variante)}
              >
                {rechazado ? TEXTOS_DEBITO.rechazado : estado.etiqueta}
              </Badge>
              <ChevronDownIcon aria-hidden="true" className="size-4 text-texto-2" />
            </div>
          </CardHeader>
        </summary>
        <CardContent className="flex flex-col gap-5 pt-2 pb-5">
          <p className="text-xs text-texto-2">Factura #{factura.id.slice(0, 8)}</p>
          {estadoActual === 'vencida' && (
            <p className="text-sm text-texto-2">
              {TEXTOS_DEBITO.vencida}{' '}
              <Link className="underline" to="/familia/comunicaciones">
                Comunicaciones
              </Link>
              .
            </p>
          )}
          {factura.detalles.length > 1 && (
            <section aria-label={`Conceptos de factura ${factura.id.slice(0, 8)}`}>
              <h3 className="mb-3 text-sm font-semibold text-texto">Conceptos</h3>
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
            </section>
          )}

          <div className="flex items-center justify-between border-t border-borde pt-4 text-sm">
            <span className="font-semibold text-texto">Total de la factura</span>
            <span className="font-semibold text-texto">{formatearMoneda(factura.monto_total)}</span>
          </div>

          {factura.pagos.length > 0 && (
            <section
              aria-label={`Débitos de factura ${factura.id.slice(0, 8)}`}
              className="border-t border-borde pt-4"
            >
              <h3 className="mb-3 text-sm font-semibold text-texto">{TEXTOS_DEBITO.registrados}</h3>
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
                        {TEXTOS_DEBITO.medio(pago.metodo_pago)} · {formatearFecha(pago.fecha)}
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
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              aria-label="Descargar factura"
              onClick={() => {
                void descargarFacturaFamilia(factura.id).catch(() =>
                  toast.error('No se pudo descargar la factura. Intentá de nuevo.'),
                )
              }}
            >
              <DownloadIcon aria-hidden="true" /> Descargar factura
            </Button>
            <Button
              type="button"
              variant="secondary"
              aria-label="Compartir factura"
              onClick={() => {
                void compartirFacturaFamilia(factura.id).catch((error: unknown) => {
                  if (error instanceof DOMException && error.name === 'AbortError') return
                  toast.error(
                    error instanceof Error ? error.message : 'No se pudo compartir la factura.',
                  )
                })
              }}
            >
              <Share2Icon aria-hidden="true" /> Compartir factura
            </Button>
          </div>
        </CardContent>
      </details>
    </Card>
  )
}

export function PortalFamiliaFacturacionPage() {
  const [resultado, setResultado] = useState<ResultadoConsultaFacturacion | null>(null)
  const [intento, setIntento] = useState(0)
  const [descargandoPagoId, setDescargandoPagoId] = useState<string | null>(null)
  const [pagina, setPagina] = useState(0)
  const [filtro, setFiltro] = useState<'todas' | EstadoFactura>('todas')
  const [alumno, setAlumno] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const cargando = resultado === null || resultado.intento !== intento
  const error = !cargando && resultado?.estado === 'error'
  const cuenta = !cargando && resultado?.estado === 'exito' ? resultado.cuenta : null
  const alumnos = [
    ...new Map(
      (cuenta?.facturas ?? []).map((factura) => [factura.alumno_id, factura.alumno_nombre]),
    ).entries(),
  ]
  const prioridad: Record<EstadoFactura, number> = { vencida: 0, pendiente: 1, pagada: 2 }
  const ordenadas = [...(cuenta?.facturas ?? [])].sort(
    (a, b) =>
      prioridad[estadoVisible(a)] - prioridad[estadoVisible(b)] ||
      vencimiento(a).localeCompare(vencimiento(b)) ||
      a.id.localeCompare(b.id),
  )
  const filtradas = ordenadas.filter((factura) => {
    const texto = [
      factura.alumno_nombre,
      factura.id,
      ...factura.detalles.map((detalle) => detalle.descripcion),
    ]
      .join(' ')
      .toLocaleLowerCase('es-AR')
    return (
      (filtro === 'todas' || estadoVisible(factura) === filtro) &&
      (alumno === 'todos' || factura.alumno_id === alumno) &&
      (!desde || vencimiento(factura) >= desde) &&
      (!hasta || vencimiento(factura) <= hasta) &&
      texto.includes(busqueda.trim().toLocaleLowerCase('es-AR'))
    )
  })

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
          Consultá las facturas y los débitos asociados a tu cuenta.
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
              <p className="mt-1 text-sm text-texto-2">{TEXTOS_DEBITO.aviso}</p>
            </div>
            {cuenta.facturas.length > 0 ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2" aria-label="Filtrar facturas">
                  {(['todas', 'vencida', 'pendiente', 'pagada'] as const).map((valor) => (
                    <Button
                      key={valor}
                      type="button"
                      variant={filtro === valor ? 'default' : 'secondary'}
                      aria-pressed={filtro === valor}
                      onClick={() => {
                        setFiltro(valor)
                        setPagina(0)
                      }}
                    >
                      {
                        {
                          todas: 'Todas',
                          vencida: 'Vencidas',
                          pendiente: 'Pendientes',
                          pagada: 'Pagadas',
                        }[valor]
                      }{' '}
                      {valor === 'todas'
                        ? ordenadas.length
                        : ordenadas.filter((factura) => estadoVisible(factura) === valor).length}
                    </Button>
                  ))}
                  {alumnos.length > 1 && (
                    <label className="flex items-center gap-2 text-sm text-texto-2">
                      Alumno{' '}
                      <select
                        aria-label="Alumno"
                        className="h-9 rounded-lg border border-borde bg-superficie px-3 text-texto focus-visible:outline-2 focus-visible:outline-mod-facturacion"
                        value={alumno}
                        onChange={(evento) => {
                          setAlumno(evento.target.value)
                          setPagina(0)
                        }}
                      >
                        <option value="todos">Todos</option>
                        {alumnos.map(([id, nombre]) => (
                          <option key={id} value={id}>
                            {nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-texto-2 focus-visible:outline-2 focus-visible:outline-mod-facturacion">
                    Más filtros
                  </summary>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-sm text-texto-2">
                      Desde{' '}
                      <input
                        aria-label="Desde"
                        type="date"
                        value={desde}
                        className="h-9 rounded-lg border border-borde bg-superficie px-3 text-texto"
                        onChange={(evento) => {
                          setDesde(evento.target.value)
                          setPagina(0)
                        }}
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm text-texto-2">
                      Hasta{' '}
                      <input
                        aria-label="Hasta"
                        type="date"
                        value={hasta}
                        className="h-9 rounded-lg border border-borde bg-superficie px-3 text-texto"
                        onChange={(evento) => {
                          setHasta(evento.target.value)
                          setPagina(0)
                        }}
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm text-texto-2">
                      Buscar{' '}
                      <input
                        aria-label="Buscar por nombre o ID"
                        placeholder="Nombre o ID"
                        value={busqueda}
                        className="h-9 rounded-lg border border-borde bg-superficie px-3 text-texto"
                        onChange={(evento) => {
                          setBusqueda(evento.target.value)
                          setPagina(0)
                        }}
                      />
                    </label>
                  </div>
                </details>
                {filtradas.length === 0 && (
                  <p className="text-sm text-texto-2">
                    No hay facturas para los filtros seleccionados.
                  </p>
                )}
                {filtradas.slice(pagina * 10, (pagina + 1) * 10).map((factura) => (
                  <FacturaFamiliaCard
                    key={factura.id}
                    factura={factura}
                    descargandoPagoId={descargandoPagoId}
                    alDescargar={(pagoId) => void descargarComprobante(pagoId)}
                  />
                ))}
                {filtradas.length > 10 && (
                  <nav
                    aria-label="Páginas de facturas"
                    className="flex items-center justify-between gap-3"
                  >
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={pagina === 0}
                      onClick={() => setPagina((actual) => actual - 1)}
                    >
                      Anterior
                    </Button>
                    <span className="text-sm text-texto-2">
                      Página {pagina + 1} de {Math.ceil(filtradas.length / 10)}
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={(pagina + 1) * 10 >= filtradas.length}
                      onClick={() => setPagina((actual) => actual + 1)}
                    >
                      Siguiente
                    </Button>
                  </nav>
                )}
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
        </div>
      )}
    </section>
  )
}
