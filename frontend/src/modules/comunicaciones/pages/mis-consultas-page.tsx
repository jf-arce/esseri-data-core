import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { CalendarDaysIcon, ChevronRightIcon, CreditCardIcon, SearchIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PortalFamiliaShell } from '@/components/portal-familia/portal-familia-shell'
import { PortalFamiliaWatermark } from '@/components/portal-familia/portal-familia-watermark'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { capitalizar } from '@/lib/texto'
import { cn } from '@/lib/utils'
import {
  ESTADOS,
  listarConversaciones,
  TITULOS,
  type Bandeja,
  type ConsultaResumen,
} from '../conversaciones'
import { SubnavComunicaciones } from '../components/subnav-comunicaciones'

type Filtro = 'todas' | 'pendientes' | 'resueltas'

const ICONO_POR_TIPO: Record<string, LucideIcon> = {
  debito_cobranza: CreditCardIcon,
  justificacion_inasistencia: CalendarDaysIcon,
  solicitud_ausencia_periodo: CalendarDaysIcon,
}

function fechaCorta(valor: string) {
  const instante = new Date(valor)
  return instante.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

function horaCorta(valor: string) {
  return new Date(valor).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function subtitulo(consulta: ConsultaResumen) {
  const { contexto } = consulta
  if (contexto.tipo === 'debito_cobranza') return contexto.concepto ?? 'Débito automático'
  if (contexto.tipo === 'solicitud_ausencia_periodo' && contexto.fecha_fin)
    return `${capitalizar(contexto.motivo ?? 'Justificación')} · ${fechaCorta(contexto.fecha_inicio)} al ${fechaCorta(contexto.fecha_fin)}`
  return capitalizar(contexto.motivo ?? 'Justificación de inasistencia')
}

function FilaConsulta({ consulta }: { consulta: ConsultaResumen }) {
  const Icono = ICONO_POR_TIPO[consulta.contexto.tipo] ?? CreditCardIcon
  const ultimo = consulta.ultimo_mensaje
  return (
    <li>
      <Link
        to={`/familia/conversaciones/${consulta.id}`}
        className="flex items-start gap-3 rounded-[16px] border border-transparent p-3 transition-colors hover:border-[#EFE9F6] hover:bg-[#FAF7FD] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A2FA8] sm:p-4"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-[#F1E4FB] text-[#7A2FA8]">
          <Icono aria-hidden="true" className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <span className="min-w-0">
              <span className="block text-[16px] font-semibold text-[#2B2338]">
                {TITULOS[consulta.contexto.tipo]}
              </span>
              <span className="block truncate text-[13px] text-[#6B6478]">
                {consulta.contexto.alumno_nombre} · {subtitulo(consulta)}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <Badge variant={consulta.estado === 'resuelta' ? 'exito' : 'advertencia'}>
                {ESTADOS[consulta.estado]}
              </Badge>
              <span className="flex flex-col items-end text-[12px] whitespace-nowrap text-[#6B6478]">
                <time dateTime={consulta.updated_at}>{fechaCorta(consulta.updated_at)}</time>
                {consulta.ultimo_mensaje && (
                  <time
                    dateTime={consulta.ultimo_mensaje.created_at}
                    className="text-[11px] text-[#8C8599]"
                  >
                    {horaCorta(consulta.ultimo_mensaje.created_at)}
                  </time>
                )}
              </span>
            </span>
          </span>
          {ultimo && (
            <span className="mt-1 block truncate text-[13px] text-[#3A2E45]">
              <span className="font-medium">
                {ultimo.lado === 'familia' ? 'Vos' : 'Administración'}:
              </span>{' '}
              {ultimo.texto}
            </span>
          )}
        </span>
        <ChevronRightIcon aria-hidden="true" className="mt-3 size-4 shrink-0 text-[#6B6478]" />
      </Link>
    </li>
  )
}

export function MisConsultasPage() {
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [buscar, setBuscar] = useState('')
  const [datos, setDatos] = useState<Bandeja | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)

  function recargar() {
    setCargando(true)
    setRevision((valor) => valor + 1)
  }

  useEffect(() => {
    const controller = new AbortController()
    void listarConversaciones(
      {
        abiertas: filtro === 'pendientes',
        estado: filtro === 'resueltas' ? 'resuelta' : undefined,
        buscar,
        limite: 50,
      },
      controller.signal,
    )
      .then((recibido) => {
        if (!controller.signal.aborted) {
          setDatos(recibido)
          setError(false)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargando(false)
      })
    return () => controller.abort()
  }, [filtro, buscar, revision])

  const resumen = datos?.resumen
  const opciones: { clave: Filtro; texto: string; cantidad?: number }[] = [
    { clave: 'todas', texto: 'Todas', cantidad: resumen?.total },
    { clave: 'pendientes', texto: 'Pendientes', cantidad: resumen?.pendientes },
    { clave: 'resueltas', texto: 'Resueltas', cantidad: resumen?.resueltas },
  ]

  return (
    <section
      className="relative isolate -mx-4 -mb-6 min-h-[calc(100svh-4rem)] overflow-hidden sm:-mx-8"
      style={{ background: 'var(--pf-canvas)' }}
    >
      <PortalFamiliaWatermark />
      <div className="relative z-10">
        <PortalFamiliaShell
          titulo="Comunicaciones"
          descripcion="Avisos del colegio y seguimiento de tus consultas"
          etiqueta="Portal de familia"
          volverA="/familia"
          volverEtiqueta="Volver al inicio"
          anchoMaximo="max-w-[92vw]"
          className="pb-6"
        />
        <SubnavComunicaciones actual="consultas" consultas={resumen?.total ?? null} />
        <div className="mx-auto w-full max-w-[92vw] px-4 pb-10 sm:px-8">
          <div className="overflow-hidden rounded-[24px] bg-white shadow-[0_14px_34px_rgba(24,16,40,0.10)]">
            <div className="flex flex-col gap-3 border-b border-[#F0EAF6] p-4 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <SearchIcon
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#8C8599]"
                />
                <Input
                  aria-label="Buscar por alumno o trámite"
                  placeholder="Buscar por alumno o trámite..."
                  value={buscar}
                  className="pl-10"
                  onChange={(evento) => setBuscar(evento.target.value)}
                />
              </div>
              <div role="group" aria-label="Filtrar consultas" className="flex flex-wrap gap-2">
                {opciones.map((opcion) => (
                  <button
                    key={opcion.clave}
                    type="button"
                    aria-pressed={filtro === opcion.clave}
                    onClick={() => setFiltro(opcion.clave)}
                    className={cn(
                      'min-h-9 rounded-full px-3 text-[13px] font-semibold transition-colors',
                      filtro === opcion.clave
                        ? 'bg-[#7A2FA8] text-white'
                        : 'text-[#3A2E45] hover:bg-[#F5EFFA]',
                    )}
                  >
                    {opcion.texto}
                    {opcion.cantidad !== undefined ? ` (${opcion.cantidad})` : ''}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-2 sm:p-3">
              {cargando ? (
                <div className="flex flex-col gap-2 p-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : error ? (
                <div className="flex flex-col items-start gap-2 p-4">
                  <p className="text-sm text-[#6B6478]">No se pudieron cargar tus consultas.</p>
                  <Button variant="secondary" onClick={recargar}>
                    Reintentar
                  </Button>
                </div>
              ) : (datos?.items.length ?? 0) === 0 ? (
                <p className="p-4 text-sm text-[#6B6478]">
                  {buscar
                    ? 'No hay consultas que coincidan con la búsqueda.'
                    : 'Todavía no tenés consultas. Podés iniciar una desde un pago rechazado o una justificación.'}
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {datos?.items.map((consulta) => (
                    <FilaConsulta key={consulta.id} consulta={consulta} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
