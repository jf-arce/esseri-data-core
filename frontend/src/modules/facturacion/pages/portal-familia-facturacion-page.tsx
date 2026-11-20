import { useEffect, useMemo, useState } from 'react'
import { ArrowUpDownIcon } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
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
import { FilterDropdown } from '@/components/filter-dropdown'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import {
  PORTAL_FAMILIA_BACKGROUND,
  PortalFamiliaShell,
} from '@/components/portal-familia/portal-familia-shell'
import { PortalFamiliaWatermark } from '@/components/portal-familia/portal-familia-watermark'
import { PortalCard, PortalStatTile } from '@/components/portal-familia/portal-familia-ui'
import { cn } from '@/lib/utils'
import { normalizarTexto } from '@/lib/texto'
import { descargarComprobantePagoFamilia } from '@/modules/facturacion/services/descargar-comprobante-pago-familia'
import { listarFacturacionFamilia } from '@/modules/facturacion/services/listar-facturacion-familia'
import {
  compartirFacturaFamilia,
  descargarFacturaFamilia,
} from '@/modules/facturacion/services/factura-pdf-familia'
import type {
  AvisoDebitoFamilia,
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
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
})
const FACTURAS_POR_PAGINA = 5
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

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
  aprobado: { etiqueta: 'Pago registrado', variante: 'exito' },
  pendiente: { etiqueta: 'En revisión', variante: 'advertencia' },
  rechazado: { etiqueta: 'Rechazado', variante: 'error' },
}

const TEXTOS_DEBITO = {
  aviso: 'Las cuotas se debitan automáticamente de tu medio de pago adherido.',
  consulta: 'Si tenés dudas sobre esta factura, escribinos desde',
  rechazado: 'Débito rechazado',
  registrados: 'Pagos registrados',
  medio: (metodo: string, medio?: 'cbu' | 'tarjeta' | null) =>
    metodo === 'debito_directo' || metodo === 'Débito por archivo'
      ? medio === 'tarjeta'
        ? 'Tarjeta de crédito'
        : 'Débito automático'
      : metodo,
}

function formatearMoneda(monto: string) {
  return FORMATEADOR_MONEDA.format(Number(monto))
}

function formatearFecha(fecha: string) {
  const fechaNormalizada = fecha.length === 10 ? `${fecha}T00:00:00Z` : fecha
  const partes = FORMATEADOR_FECHA.formatToParts(new Date(fechaNormalizada))
  const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? ''
  return `${valor('day')}/${valor('month')}/${valor('year')}`
}

/** "Cuota 2026-11" → "Cuota noviembre 2026". */
function formatearConcepto(descripcion: string) {
  return descripcion.replace(/\b(\d{4})-(\d{2})\b/g, (_, anio: string, mes: string) => {
    const nombre = MESES[Number(mes) - 1]
    return nombre ? `${nombre} ${anio}` : `${mes}/${anio}`
  })
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
    <section aria-label="Resumen de cuenta" className="grid gap-4 lg:grid-cols-3">
      <PortalStatTile
        label="Cargos emitidos"
        value={formatearMoneda(cuenta.total_debe)}
        icon={ReceiptTextIcon}
        tone="lavanda"
      />
      <PortalStatTile
        label={TEXTOS_DEBITO.registrados}
        value={formatearMoneda(cuenta.total_haber)}
        icon={CircleDollarSignIcon}
        tone="verde"
      />
      <PortalStatTile
        label={saldo < 0 ? 'Saldo a favor' : 'Saldo pendiente'}
        value={formatearMoneda(String(Math.abs(saldo)))}
        icon={WalletIcon}
        tone={vencidas.length > 0 ? 'rojo' : 'ambar'}
        detalle={
          <>
            {proxima && (
              <span className="block">
                Próximo vencimiento:{' '}
                {diasParaVencer(vencimiento(proxima)) === 0
                  ? 'hoy'
                  : diasParaVencer(vencimiento(proxima)) === 1
                    ? 'mañana'
                    : formatearFecha(vencimiento(proxima))}{' '}
                · {formatearMoneda(proxima.monto_total)}
              </span>
            )}
            {vencidas.length > 0 && (
              <span className="block font-medium text-error">
                {formatearMoneda(String(totalVencido / 100))} vencido
              </span>
            )}
          </>
        }
      />
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
  if (variante === 'advertencia') return 'text-advertencia [.dark_&]:text-advertencia'
  if (variante === 'exito') return 'text-exito [.dark_&]:text-exito'
  return undefined
}

function tieneDebitoRechazado(factura: FacturaFamilia, aviso?: AvisoDebitoFamilia) {
  const resultado = factura.ultimo_resultado_debito ?? aviso
  if (resultado) return resultado.resultado === 'rechazado'
  return (
    factura.pagos
      .filter(
        (pago) =>
          pago.metodo_pago === 'debito_directo' || pago.metodo_pago === 'Débito por archivo',
      )
      .sort((a, b) => b.fecha.localeCompare(a.fecha))[0]?.estado === 'rechazado'
  )
}

function FacturaFamiliaCard({
  factura,
  aviso,
  descargandoPagoId,
  alDescargar,
  resaltada = false,
  abrirInicial = false,
  alAlternar,
}: {
  factura: FacturacionFamilia['facturas'][number]
  aviso?: AvisoDebitoFamilia
  descargandoPagoId: string | null
  alDescargar: (pagoId: string) => void
  resaltada?: boolean
  abrirInicial?: boolean
  alAlternar?: (abierta: boolean) => void
}) {
  const [abierta, setAbierta] = useState(abrirInicial)
  const estadoActual = estadoVisible(factura)
  const estado = ESTADOS_FACTURA[estadoActual]
  const rechazado = tieneDebitoRechazado(factura, aviso)
  const resultado = factura.ultimo_resultado_debito ?? aviso
  const motivo = resultado?.resultado === 'rechazado' ? resultado.motivo_rechazo.trim() : ''
  const concepto = factura.detalles[0]?.descripcion?.trim()
    ? formatearConcepto(factura.detalles[0].descripcion.trim())
    : `Cuota ${MESES[Number(vencimiento(factura).slice(5, 7)) - 1]} ${vencimiento(factura).slice(0, 4)}`
  const periodo = `${MESES[Number(vencimiento(factura).slice(5, 7)) - 1]} ${vencimiento(factura).slice(0, 4)}`
  const titulo = `Factura de ${periodo}`
  return (
    <Card
      id={`factura-${factura.id}`}
      aria-current={resaltada ? 'true' : undefined}
      className={cn(
        'gap-0 rounded-pf-card border-0 bg-superficie py-0 shadow-pf-card',
        resaltada && 'ring-2 ring-pf-accent/35',
      )}
    >
      <details
        open={abierta}
        onToggle={(evento) => {
          const siguiente = evento.currentTarget.open
          setAbierta(siguiente)
          alAlternar?.(siguiente)
        }}
      >
        <summary
          aria-expanded={abierta}
          className="cursor-pointer list-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-pf-accent"
        >
          <CardHeader className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <CardTitle>{titulo}</CardTitle>
              <CardDescription>
                {concepto} · {factura.alumno_nombre} · Vence {formatearFecha(vencimiento(factura))}
              </CardDescription>
              {rechazado && estadoActual !== 'pagada' && (
                <span className="text-sm font-medium text-error">
                  {TEXTOS_DEBITO.rechazado}
                  {motivo ? `: ${motivo}` : ''}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-texto">
                {formatearMoneda(factura.monto_total)}
              </span>
              <Badge variant={estado.variante} className={colorAccesible(estado.variante)}>
                {estado.etiqueta}
              </Badge>
              <ChevronDownIcon aria-hidden="true" className="size-4 text-texto-2" />
            </div>
          </CardHeader>
        </summary>
        <CardContent className="flex flex-col gap-5 pt-2 pb-5">
          <p className="text-xs text-texto-2">
            Factura {resultado?.numero_factura ?? `#${factura.id.slice(0, 8)}`}
          </p>
          {resultado?.resultado === 'rechazado' && (
            <section
              aria-label={`Débito automático de factura ${resultado.numero_factura}`}
              className="rounded-pf-tile bg-pf-rojo-card p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="error">{TEXTOS_DEBITO.rechazado}</Badge>
                <span className="text-sm font-medium text-texto">
                  {formatearMoneda(resultado.importe)}
                </span>
                <span className="text-xs text-texto-2">{formatearFecha(resultado.fecha)}</span>
              </div>
              {motivo && <p className="mt-2 text-sm text-texto-2">Motivo: {motivo}.</p>}
            </section>
          )}
          {estadoActual === 'vencida' && (
            <p className="text-sm text-texto-2">
              {TEXTOS_DEBITO.consulta}{' '}
              <Link className="underline" to="/familia/comunicaciones">
                Comunicaciones
              </Link>
              .
            </p>
          )}
          {factura.detalles.length > 0 && (
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
                    <span className="text-texto-2">{formatearConcepto(detalle.descripcion)}</span>
                    <span className="shrink-0 font-medium text-texto">
                      {formatearMoneda(detalle.monto)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="flex items-center justify-between border-t border-pf-divisor pt-4 text-sm">
            <span className="font-semibold text-texto">Total de la factura</span>
            <span className="font-semibold text-texto">{formatearMoneda(factura.monto_total)}</span>
          </div>

          {factura.pagos.length > 0 && (
            <section
              aria-label={`Débitos de factura ${factura.id.slice(0, 8)}`}
              className="border-t border-pf-divisor pt-4"
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
                        {TEXTOS_DEBITO.medio(pago.metodo_pago, factura.medio)} ·{' '}
                        {formatearFecha(pago.fecha)}
                      </span>
                      <EstadoPago pago={pago} />
                    </div>
                    {pago.comprobante_disponible && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="rounded-full"
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
              className="rounded-full"
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
              className="rounded-full"
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
  const [filtro, setFiltro] = useState<'todas' | EstadoFactura | 'rechazadas'>('todas')
  const [searchParams, setSearchParams] = useSearchParams()
  const [alumno, setAlumno] = useState(() => searchParams.get('alumno') ?? 'todos')
  const [busqueda, setBusqueda] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [orden, setOrden] = useState<'vencimiento-asc' | 'vencimiento-desc' | 'emision-desc'>(
    'vencimiento-asc',
  )
  const cargando = resultado === null || resultado.intento !== intento
  const error = !cargando && resultado?.estado === 'error'
  const cuenta = !cargando && resultado?.estado === 'exito' ? resultado.cuenta : null
  const avisoDe = (facturaId: string) =>
    (cuenta?.avisos_debito ?? [])
      .filter((aviso) => aviso.factura_id === facturaId)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
  const rechazadas = (cuenta?.facturas ?? []).filter((factura) =>
    tieneDebitoRechazado(factura, avisoDe(factura.id)),
  ).length
  const acreditadas = (cuenta?.facturas ?? []).filter(
    (factura) => (factura.ultimo_resultado_debito ?? avisoDe(factura.id))?.resultado === 'exitoso',
  ).length
  const alumnos = [
    ...new Map(
      (cuenta?.facturas ?? []).map((factura) => [factura.alumno_id, factura.alumno_nombre]),
    ).entries(),
  ]
  const ordenadas = [...(cuenta?.facturas ?? [])].sort((a, b) => {
    if (orden === 'vencimiento-desc') {
      return vencimiento(b).localeCompare(vencimiento(a)) || a.id.localeCompare(b.id)
    }
    if (orden === 'emision-desc') {
      return (
        b.fecha_emision.localeCompare(a.fecha_emision) ||
        vencimiento(a).localeCompare(vencimiento(b))
      )
    }
    return vencimiento(a).localeCompare(vencimiento(b)) || a.id.localeCompare(b.id)
  })
  const busquedaNormalizada = normalizarTexto(busqueda)
  const filtradas = ordenadas.filter((factura) => {
    const texto = normalizarTexto(
      [
        factura.alumno_nombre,
        factura.id,
        ...factura.detalles.map((detalle) => detalle.descripcion),
      ].join(' '),
    )
    return (
      (filtro === 'todas' ||
        (filtro === 'rechazadas'
          ? tieneDebitoRechazado(factura, avisoDe(factura.id))
          : estadoVisible(factura) === filtro)) &&
      (alumno === 'todos' || factura.alumno_id === alumno) &&
      (!desde || vencimiento(factura) >= desde) &&
      (!hasta || vencimiento(factura) <= hasta) &&
      texto.includes(busquedaNormalizada)
    )
  })
  const facturaParam = searchParams.get('factura')
  const pagoParam = searchParams.get('pago')
  const focoFacturaId = useMemo(() => {
    if (!cuenta) return null
    if (facturaParam) {
      return cuenta.facturas.some((factura) => factura.id === facturaParam) ? facturaParam : null
    }
    if (pagoParam) {
      return (
        cuenta.facturas.find((factura) => factura.pagos.some((pago) => pago.id === pagoParam))
          ?.id ?? null
      )
    }
    return null
  }, [cuenta, facturaParam, pagoParam])

  function limpiarFoco() {
    if (!facturaParam && !pagoParam) return
    const siguientes = new URLSearchParams(searchParams)
    siguientes.delete('factura')
    siguientes.delete('pago')
    setSearchParams(siguientes, { replace: true })
  }

  useEffect(() => {
    if (!focoFacturaId) return
    const indice = ordenadas.findIndex((factura) => factura.id === focoFacturaId)
    const cuadro = window.setTimeout(() => {
      if (indice >= 0) setPagina(Math.floor(indice / 10))
      document.getElementById(`factura-${focoFacturaId}`)?.scrollIntoView?.({ block: 'center' })
    }, 0)
    return () => window.clearTimeout(cuadro)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- el foco se recalcula al cargar la cuenta
  }, [focoFacturaId, cuenta])

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
    <section
      className="relative isolate -mb-6 min-h-[calc(100svh-4rem)]"
      style={{ background: PORTAL_FAMILIA_BACKGROUND }}
    >
      <PortalFamiliaWatermark />
      <div className="relative z-10">
        <PortalFamiliaShell
          titulo="Facturación"
          descripcion="Consultá las facturas y los débitos asociados a tu cuenta."
          etiqueta="Portal de familia"
          className="pb-8"
          volverA="/familia"
          volverEtiqueta="Volver al inicio"
          acciones={
            alumnos.length > 1 ? (
              <FilterDropdown
                className="rounded-full bg-superficie/95"
                label={
                  alumno === 'todos'
                    ? 'Alumno'
                    : `Alumno: ${alumnos.find(([id]) => id === alumno)?.[1] ?? ''}`
                }
                value={alumno}
                onChange={(valor) => {
                  setAlumno(valor)
                  setPagina(0)
                  const siguientes = new URLSearchParams(searchParams)
                  if (valor === 'todos') siguientes.delete('alumno')
                  else siguientes.set('alumno', valor)
                  setSearchParams(siguientes, { replace: true })
                }}
                options={[
                  { value: 'todos', label: 'Todos' },
                  ...alumnos.map(([id, nombre]) => ({ value: id, label: nombre })),
                ]}
              />
            ) : undefined
          }
        />

        <div className="flex w-full flex-col gap-6 pb-10">
          {cargando && (
            <div role="status" aria-label="Cargando facturación" className="flex flex-col gap-4">
              <div className="grid gap-4 lg:grid-cols-3">
                <Skeleton className="h-24 rounded-pf-tile" />
                <Skeleton className="h-24 rounded-pf-tile" />
                <Skeleton className="h-24 rounded-pf-tile" />
              </div>
              <Skeleton className="h-64 rounded-pf-card" />
            </div>
          )}

          {error && !cargando && (
            <Empty role="alert" className="min-h-64 rounded-pf-card bg-superficie shadow-pf-card">
              <EmptyMedia variant="neutral">
                <ReceiptTextIcon />
              </EmptyMedia>
              <EmptyTitle>No pudimos cargar tu facturación.</EmptyTitle>
              <EmptyDescription>Revisá tu conexión e intentá nuevamente.</EmptyDescription>
              <Button
                type="button"
                variant="secondary"
                className="rounded-full"
                onClick={() => setIntento((actual) => actual + 1)}
              >
                Reintentar
              </Button>
            </Empty>
          )}

          {cuenta && !cargando && !error && (
            <div className="flex flex-col gap-6">
              <ResumenCuenta cuenta={cuenta} />

              {(acreditadas > 0 || rechazadas > 0) && (
                <section aria-labelledby="avisos-debito-heading">
                  <PortalCard
                    titulo="Avisos de débitos automáticos"
                    tituloId="avisos-debito-heading"
                    descripcion={`${acreditadas} acreditados · ${rechazadas} rechazados. El detalle está en cada factura.`}
                    nivelEncabezado={2}
                  >
                    {rechazadas > 0 && (
                      <Button
                        type="button"
                        variant="secondary"
                        className="rounded-full"
                        onClick={() => setFiltro('rechazadas')}
                      >
                        Ver facturas con débito rechazado
                      </Button>
                    )}
                  </PortalCard>
                </section>
              )}

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
                    <div
                      className="flex flex-wrap items-center gap-2"
                      aria-label="Filtrar facturas"
                    >
                      {(['todas', 'vencida', 'pendiente', 'pagada', 'rechazadas'] as const).map(
                        (valor) => (
                          <Button
                            key={valor}
                            type="button"
                            variant={filtro === valor ? 'default' : 'secondary'}
                            className="rounded-full"
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
                                rechazadas: 'Con débito rechazado',
                              }[valor]
                            }{' '}
                            {valor === 'todas'
                              ? ordenadas.length
                              : valor === 'rechazadas'
                                ? rechazadas
                                : ordenadas.filter((factura) => estadoVisible(factura) === valor)
                                    .length}
                          </Button>
                        ),
                      )}
                      <FilterDropdown
                        className="rounded-full"
                        label={`Ordenar: ${
                          {
                            'vencimiento-asc': 'Vencimiento próximo',
                            'vencimiento-desc': 'Vencimiento lejano',
                            'emision-desc': 'Emisión reciente',
                          }[orden]
                        }`}
                        active
                        icon={ArrowUpDownIcon}
                        align="end"
                        value={orden}
                        onChange={(valor) => {
                          setOrden(valor as typeof orden)
                          setPagina(0)
                        }}
                        options={[
                          { value: 'vencimiento-asc', label: 'Vencimiento (más próximo)' },
                          { value: 'vencimiento-desc', label: 'Vencimiento (más lejano)' },
                          { value: 'emision-desc', label: 'Emisión (más reciente)' },
                        ]}
                      />
                    </div>
                    <details>
                      <summary className="cursor-pointer text-sm font-semibold text-texto focus-visible:outline-2 focus-visible:outline-pf-accent">
                        Más filtros
                      </summary>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-2 text-sm text-texto">
                          Desde{' '}
                          <input
                            aria-label="Desde"
                            type="date"
                            value={desde}
                            className="h-9 rounded-lg border border-pf-divisor bg-superficie px-3 text-texto"
                            onChange={(evento) => {
                              setDesde(evento.target.value)
                              setPagina(0)
                            }}
                          />
                        </label>
                        <label className="flex items-center gap-2 text-sm text-texto">
                          Hasta{' '}
                          <input
                            aria-label="Hasta"
                            type="date"
                            value={hasta}
                            className="h-9 rounded-lg border border-pf-divisor bg-superficie px-3 text-texto"
                            onChange={(evento) => {
                              setHasta(evento.target.value)
                              setPagina(0)
                            }}
                          />
                        </label>
                        <label className="flex items-center gap-2 text-sm text-texto">
                          Buscar{' '}
                          <input
                            aria-label="Buscar por nombre o ID"
                            placeholder="Nombre o ID"
                            value={busqueda}
                            className="h-9 rounded-lg border border-pf-divisor bg-superficie px-3 text-texto"
                            onChange={(evento) => {
                              setBusqueda(evento.target.value)
                              setPagina(0)
                            }}
                          />
                        </label>
                      </div>
                    </details>
                    {filtradas.length === 0 && (
                      <p className="text-sm text-texto">
                        No hay facturas para los filtros seleccionados.
                      </p>
                    )}
                    {filtradas
                      .slice(pagina * FACTURAS_POR_PAGINA, (pagina + 1) * FACTURAS_POR_PAGINA)
                      .map((factura) => (
                        <FacturaFamiliaCard
                          key={factura.id === focoFacturaId ? `${factura.id}-foco` : factura.id}
                          factura={factura}
                          aviso={avisoDe(factura.id)}
                          descargandoPagoId={descargandoPagoId}
                          alDescargar={(pagoId) => void descargarComprobante(pagoId)}
                          resaltada={factura.id === focoFacturaId}
                          abrirInicial={factura.id === focoFacturaId}
                          alAlternar={(abierta) => {
                            if (!focoFacturaId) return
                            if (factura.id !== focoFacturaId || !abierta) limpiarFoco()
                          }}
                        />
                      ))}
                    {filtradas.length > FACTURAS_POR_PAGINA && (
                      <nav
                        aria-label="Páginas de facturas"
                        className="flex items-center justify-between gap-3"
                      >
                        <Button
                          type="button"
                          variant="secondary"
                          className="rounded-full"
                          disabled={pagina === 0}
                          onClick={() => setPagina((actual) => actual - 1)}
                        >
                          Anterior
                        </Button>
                        <span className="text-sm text-texto">
                          Página {pagina + 1} de {Math.ceil(filtradas.length / FACTURAS_POR_PAGINA)}
                        </span>
                        <Button
                          type="button"
                          variant="secondary"
                          className="rounded-full"
                          disabled={(pagina + 1) * FACTURAS_POR_PAGINA >= filtradas.length}
                          onClick={() => setPagina((actual) => actual + 1)}
                        >
                          Siguiente
                        </Button>
                      </nav>
                    )}
                  </div>
                ) : (
                  <Empty className="min-h-52 rounded-pf-card bg-superficie shadow-pf-card">
                    <EmptyMedia variant="icon" className="bg-pf-ambar-card text-advertencia">
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
        </div>
      </div>
    </section>
  )
}
