import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRightIcon,
  CalendarClockIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  MailIcon,
  ReceiptTextIcon,
  UsersIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PortalFamiliaShell } from '@/components/portal-familia/portal-familia-shell'
import { PortalFamiliaWatermark } from '@/components/portal-familia/portal-familia-watermark'
import {
  PORTAL_PRIMARY_BUTTON_CLASS,
  PortalAlertBanner,
  PortalCard,
  PortalSkeletonRegion,
} from '@/components/portal-familia/portal-familia-ui'
import { TONOS, type PortalFamiliaTone } from '@/components/portal-familia/portal-familia-tonos'
import { useMisAlumnos } from '@/modules/familias-alumnos/hooks/use-mis-alumnos'
import { listarComunicaciones } from '@/modules/comunicaciones/services/listar-comunicaciones'
import { listarAsistenciasFamilia } from '@/modules/academico/services/listar-asistencias-familia'
import { listarSolicitudesAusenciaFamilia } from '@/modules/academico/services/solicitudes-ausencia-familia'
import { esAusenciaSinJustificar } from '@/modules/academico/utils'
import { listarFacturacionFamilia } from '@/modules/facturacion/services/listar-facturacion-familia'
import { formatearMoneda } from '@/modules/facturacion/utils'
import type { FacturacionFamilia } from '@/modules/facturacion/types'
import { nombreDeUsuario } from '@/modules/auth/utils'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'

function saludoSegunHora(hora: number): string {
  if (hora >= 6 && hora < 13) return 'Buen día'
  if (hora >= 13 && hora < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

type PendienteChip = {
  clave: string
  texto: string
  tono: PortalFamiliaTone
  href: string
}

function crearChips(items: [number, string, string, PortalFamiliaTone, string][]): PendienteChip[] {
  return items
    .filter(([cantidad]) => cantidad > 0)
    .map(([cantidad, singular, plural, tono, href]) => ({
      clave: href,
      texto: `${cantidad} ${cantidad === 1 ? singular : plural}`,
      tono,
      href,
    }))
}

function iniciales(nombre: string, apellido: string) {
  return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase()
}

type IndicadorCompactoProps = {
  etiqueta: string
  valor: number | string
  icono: LucideIcon
  tono: PortalFamiliaTone
  cargando?: boolean
  href?: string
}

/** Indicador horizontal bajo del inicio, con cifra y etiqueta en una sola línea. */
function IndicadorCompacto({
  etiqueta,
  valor,
  icono: Icono,
  tono,
  cargando = false,
  href,
}: IndicadorCompactoProps) {
  const contenido = (
    <>
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-pf-item',
          TONOS[tono].tile,
        )}
      >
        <Icono aria-hidden="true" className="size-5" />
      </span>
      <span aria-hidden="true" className="h-9 w-px shrink-0 bg-pf-lila" />
      <span className="min-w-0 flex-1">
        {cargando ? (
          <Skeleton className="h-7 w-10" />
        ) : (
          <span className="block font-heading text-pf-cifra leading-none font-bold text-texto tabular-nums">
            {valor}
          </span>
        )}
        <span className="mt-1 block text-sm leading-tight text-texto-2 sm:text-sm">{etiqueta}</span>
      </span>
      {href && <ChevronRightIcon aria-hidden="true" className="size-5 shrink-0 text-texto" />}
    </>
  )

  const clases =
    'flex min-h-[74px] items-center gap-3 rounded-pf-tile bg-superficie px-4 py-3 shadow-pf-card'

  return href ? (
    <Link
      to={href}
      aria-label={`${etiqueta}: ${valor}`}
      className={cn(clases, 'transition-colors hover:bg-(--card-hover)')}
    >
      {contenido}
    </Link>
  ) : (
    <div role="group" aria-label={etiqueta} className={clases}>
      {contenido}
    </div>
  )
}

export function PortalFamiliaPage() {
  const usuario = useAuthStore((state) => state.usuario)
  const { alumnos, cargando: cargandoAlumnos } = useMisAlumnos(true)
  const [sinLeer, setSinLeer] = useState<{ total: number | null; cargando: boolean }>({
    total: null,
    cargando: true,
  })
  const [asistencias, setAsistencias] = useState<{ total: number | null; cargando: boolean }>({
    total: null,
    cargando: true,
  })
  const [facturacion, setFacturacion] = useState<{
    cuenta: FacturacionFamilia | null
    cargando: boolean
  }>({ cuenta: null, cargando: true })

  const saludo = useMemo(() => {
    if (!usuario) return ''
    if (usuario.persona_nombre) return usuario.persona_nombre.split(' ')[0]
    return nombreDeUsuario(usuario.email).split(/[ ,]/)[0]
  }, [usuario])

  const horaArgentina = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Argentina/Buenos_Aires',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(new Date()),
  )
  const saludoHora = saludoSegunHora(horaArgentina)

  useEffect(() => {
    if (alumnos.length === 0) return
    let activo = true
    Promise.all(
      alumnos.map(async (alumno) => {
        const [lista, solicitudes] = await Promise.all([
          listarAsistenciasFamilia(alumno.alumno_id),
          listarSolicitudesAusenciaFamilia(alumno.alumno_id).catch(() => []),
        ])
        return { lista, solicitudes }
      }),
    )
      .then((resultados) => {
        if (!activo) return
        const total = resultados.reduce((acumulado, { lista, solicitudes }) => {
          const activas = solicitudes.filter(
            (solicitud) => solicitud.estado === 'pendiente' || solicitud.estado === 'aprobada',
          )
          const cubierta = (fecha: string) =>
            activas.some(
              (solicitud) => solicitud.fecha_inicio <= fecha && solicitud.fecha_fin >= fecha,
            )
          return (
            acumulado +
            lista.filter(
              (asistencia) => esAusenciaSinJustificar(asistencia) && !cubierta(asistencia.fecha),
            ).length
          )
        }, 0)
        setAsistencias({ total, cargando: false })
      })
      .catch(() => {
        if (activo) setAsistencias({ total: null, cargando: false })
      })
    return () => {
      activo = false
    }
  }, [alumnos])

  useEffect(() => {
    if (!usuario) return
    const controller = new AbortController()
    listarComunicaciones(true, 1, '', true, controller.signal)
      .then((listado) => setSinLeer({ total: listado.total, cargando: false }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setSinLeer({ total: null, cargando: false })
      })
    return () => controller.abort()
  }, [usuario])

  useEffect(() => {
    if (!usuario) return
    const controller = new AbortController()
    listarFacturacionFamilia(controller.signal)
      .then((cuenta) => setFacturacion({ cuenta, cargando: false }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setFacturacion({ cuenta: null, cargando: false })
      })
    return () => controller.abort()
  }, [usuario])

  const cargandoAsistencias = cargandoAlumnos || (alumnos.length > 0 && asistencias.cargando)
  const pendientesJustificar = alumnos.length === 0 ? 0 : asistencias.total
  const hayAusenciasPendientes = pendientesJustificar !== null && pendientesJustificar > 0
  const hoyArgentina = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const facturasVencidas =
    facturacion.cuenta?.facturas.filter(
      (factura) =>
        factura.estado !== 'pagada' &&
        (factura.estado === 'vencida' ||
          (factura.fecha_vencimiento_efectiva || factura.fecha_vencimiento) < hoyArgentina),
    ).length ?? 0
  const saldoCuenta = facturacion.cuenta ? Number(facturacion.cuenta.saldo) : null
  const saldoAFavor = saldoCuenta !== null && saldoCuenta < 0
  const estadoFacturacion =
    facturasVencidas > 0
      ? `${facturasVencidas} ${facturasVencidas === 1 ? 'vencida' : 'vencidas'}`
      : 'Sin vencimientos'

  const cargandoResumen = cargandoAsistencias || sinLeer.cargando || facturacion.cargando
  const chips = cargandoResumen
    ? []
    : crearChips([
        [
          sinLeer.total ?? 0,
          'comunicación sin leer',
          'comunicaciones sin leer',
          'azul',
          '/familia/comunicaciones',
        ],
        [facturasVencidas, 'factura vencida', 'facturas vencidas', 'rojo', '/familia/facturacion'],
      ])
  const resumen = cargandoResumen ? (
    'Estamos armando el resumen de tu familia.'
  ) : chips.length === 0 ? (
    hayAusenciasPendientes ? null : 'Todo al día por ahora.'
  ) : (
    <span className="flex flex-wrap items-center gap-1.5 text-sm">
      {chips.map((chip) => (
        <Link
          key={chip.clave}
          to={chip.href}
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-texto transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-accent',
            TONOS[chip.tono].tile,
          )}
        >
          {chip.texto}
        </Link>
      ))}
    </span>
  )

  return (
    <section className="relative isolate flex w-full flex-col">
      <PortalFamiliaWatermark />
      <PortalFamiliaShell
        titulo={<>{saludo ? `¡${saludoHora}, ${saludo}!` : `¡${saludoHora}!`}</>}
        descripcion={resumen}
        ilustracion={
          <img
            src="/esseri-icon.png"
            alt=""
            draggable={false}
            className="h-full w-auto opacity-80"
          />
        }
        className="pb-8"
      />

      <div className="relative flex w-full flex-col gap-5">
        <div className="flex flex-col gap-5">
          <div className="grid gap-3 @3xl/main:grid-cols-3">
            <IndicadorCompacto
              etiqueta="Alumnos vinculados"
              valor={alumnos.length}
              icono={UsersIcon}
              tono="lavanda"
              cargando={cargandoAlumnos}
            />
            <IndicadorCompacto
              etiqueta={pendientesJustificar === 1 ? 'Ausencia pendiente' : 'Ausencias pendientes'}
              valor={cargandoAsistencias ? '-' : (pendientesJustificar ?? '-')}
              icono={CalendarClockIcon}
              tono="ambar"
              cargando={cargandoAsistencias}
            />
            <IndicadorCompacto
              etiqueta="Comunicaciones sin leer"
              valor={sinLeer.cargando ? '-' : (sinLeer.total ?? '-')}
              icono={MailIcon}
              tono="azul"
              cargando={sinLeer.cargando}
              href="/familia/comunicaciones"
            />
          </div>

          {hayAusenciasPendientes && (
            <PortalAlertBanner
              titulo={
                pendientesJustificar === 1
                  ? 'Tenés una ausencia pendiente'
                  : `Tenés ${pendientesJustificar} ausencias pendientes`
              }
              descripcion="Podés justificarla desde el portal."
              accion={
                <Button asChild className={PORTAL_PRIMARY_BUTTON_CLASS}>
                  <Link to="/familia/justificar-ausencia">
                    Justificar ausencia
                    <ArrowRightIcon aria-hidden="true" className="size-4" />
                  </Link>
                </Button>
              }
            />
          )}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <PortalCard
            titulo="Mis alumnos"
            descripcion="Accedé a la información y gestiones de cada alumno."
            tituloClassName="font-heading text-pf-encabezado font-bold tracking-[-0.01em] text-texto"
            headerClassName="border-b border-pf-divisor px-5 py-4"
            contentClassName="px-4 py-3"
          >
            {cargandoAlumnos ? (
              <PortalSkeletonRegion etiqueta="Cargando alumnos">
                <ul aria-hidden="true" className="flex flex-col gap-4">
                  {[0, 1].map((indice) => (
                    <li
                      key={indice}
                      className="flex flex-wrap items-center gap-3 rounded-pf-icono border border-pf-divisor bg-superficie px-3 py-2.5"
                    >
                      <Skeleton className="size-10 shrink-0 rounded-full" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-4 w-40 max-w-full" />
                        <Skeleton className="h-3.5 w-20" />
                      </div>
                      <div className="flex min-h-9 w-full items-center gap-3 sm:w-auto">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-14" />
                      </div>
                    </li>
                  ))}
                </ul>
              </PortalSkeletonRegion>
            ) : alumnos.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <span className="flex size-10 items-center justify-center rounded-full bg-pf-lila text-pf-accent">
                  <UsersIcon aria-hidden="true" className="size-5" />
                </span>
                <p className={cn('text-pf-cuerpo font-semibold', 'text-texto')}>
                  No encontramos alumnos vinculados a tu cuenta.
                </p>
                <p className={cn('max-w-[280px] text-sm', 'text-texto-2')}>
                  Comunicate con el colegio para vincular tu cuenta.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-4">
                {alumnos.map((alumno) => (
                  <li
                    key={alumno.alumno_id}
                    className="rounded-pf-icono border border-pf-divisor bg-superficie px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-pf-lila-fuerte text-sm font-semibold text-pf-accent">
                        {iniciales(alumno.nombre, alumno.apellido)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'truncate text-pf-cuerpo leading-tight font-semibold',
                            'text-texto',
                          )}
                        >
                          {alumno.apellido}, {alumno.nombre}
                        </p>
                        <p className={cn('mt-0.5 text-sm', 'text-texto-2')}>
                          {alumno.division_etiqueta ?? 'Curso no informado'}
                        </p>
                      </div>
                      <div className="flex w-full flex-wrap items-center gap-1 sm:w-auto">
                        <Link
                          to="/familia/asistencias"
                          className={cn(
                            'inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-sm font-semibold',
                            'text-pf-accent hover:text-pf-accent-hover',
                          )}
                        >
                          Asistencias
                        </Link>
                        <span aria-hidden="true" className="h-4 w-px bg-pf-lila" />
                        <Link
                          to={`/familia/facturacion?alumno=${alumno.alumno_id}`}
                          className={cn(
                            'inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-sm font-semibold',
                            'text-pf-accent hover:text-pf-accent-hover',
                          )}
                        >
                          Facturación
                        </Link>
                        <span aria-hidden="true" className="h-4 w-px bg-pf-lila" />
                        <Link
                          to={`/familia/calendario?alumno=${alumno.alumno_id}`}
                          className={cn(
                            'inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-sm font-semibold',
                            'text-pf-accent hover:text-pf-accent-hover',
                          )}
                        >
                          Horario
                        </Link>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PortalCard>

          <aside className="flex min-w-0 flex-col gap-5">
            <PortalCard
              icono={ReceiptTextIcon}
              tone="verde"
              titulo="Facturación familiar"
              descripcion="Estado general de la cuenta familiar."
              headerClassName="px-5 pt-5 pb-4"
              contentClassName="px-5 pt-4 pb-4"
            >
              <div className="flex flex-col">
                <div className="border-t border-pf-divisor pt-3">
                  <p className="text-sm font-medium text-texto-2">
                    {saldoAFavor ? 'Saldo a favor' : 'Saldo pendiente'}
                  </p>
                  {facturacion.cargando ? (
                    <Skeleton className="mt-1 h-8 w-28" />
                  ) : (
                    <p
                      className={cn(
                        'mt-1 font-heading text-pf-cifra leading-none font-bold tabular-nums',
                        'text-texto',
                      )}
                    >
                      {facturacion.cuenta ? formatearMoneda(Math.abs(saldoCuenta ?? 0)) : '-'}
                    </p>
                  )}
                  {facturacion.cargando ? (
                    <Skeleton className="mt-3 h-5 w-32" />
                  ) : facturacion.cuenta ? (
                    <p
                      className={cn(
                        'mt-3 inline-flex items-center gap-1.5 text-sm font-medium',
                        facturasVencidas > 0 ? 'text-error' : 'text-exito',
                      )}
                    >
                      {facturasVencidas > 0 ? (
                        <CircleAlertIcon aria-hidden="true" className="size-4" />
                      ) : (
                        <CircleCheckIcon aria-hidden="true" className="size-4" />
                      )}
                      {estadoFacturacion}
                    </p>
                  ) : null}
                </div>
                <Link
                  to="/familia/facturacion"
                  className={cn(
                    'mt-4 flex min-h-11 items-center justify-between border-t border-pf-divisor pt-3 text-pf-cuerpo font-semibold',
                    'text-pf-accent hover:text-pf-accent-hover',
                  )}
                >
                  Ver facturación
                  <ChevronRightIcon aria-hidden="true" className="size-4" />
                </Link>
              </div>
            </PortalCard>
          </aside>
        </div>
      </div>
    </section>
  )
}
