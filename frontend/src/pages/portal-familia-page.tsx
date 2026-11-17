import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRightIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
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
} from '@/components/portal-familia/portal-familia-ui'
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

const TINTA = 'text-[#2B2338]'
const TINTA_2 = 'text-[#6B6478]'
const ENLACE_VIOLETA = 'text-[#7A2FA8] hover:text-[#6A2494]'

function iniciales(nombre: string, apellido: string) {
  return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase()
}

const TONOS_INDICADOR = {
  lavanda: 'bg-[#F1E4FB] text-[#7A2FA8]',
  ambar: 'bg-[#FCE4CA] text-[#DF8A2F]',
  azul: 'bg-[#DCE9FC] text-[#4F86D9]',
} as const

type IndicadorCompactoProps = {
  etiqueta: string
  valor: number | string
  icono: LucideIcon
  tono: keyof typeof TONOS_INDICADOR
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
          'flex size-10 shrink-0 items-center justify-center rounded-[12px]',
          TONOS_INDICADOR[tono],
        )}
      >
        <Icono aria-hidden="true" className="size-5" />
      </span>
      <span aria-hidden="true" className="h-9 w-px shrink-0 bg-[#EEE7F5]" />
      <span className="min-w-0 flex-1">
        {cargando ? (
          <Skeleton className="h-7 w-10 bg-[#F1EAF7]" />
        ) : (
          <span className="block font-heading text-[24px] leading-none font-bold text-[#2B2338] tabular-nums">
            {valor}
          </span>
        )}
        <span className="mt-1 block text-[13px] leading-tight text-[#6B6478] sm:text-[14px]">
          {etiqueta}
        </span>
      </span>
      {href && <ChevronRightIcon aria-hidden="true" className="size-5 shrink-0 text-[#3A2E45]" />}
    </>
  )

  const clases =
    'flex min-h-[74px] items-center gap-3 rounded-[18px] border border-[#E9E1F1] bg-white px-4 py-3 shadow-[0_6px_18px_rgba(24,16,40,0.05)]'

  return href ? (
    <Link
      to={href}
      aria-label={`${etiqueta}: ${valor}`}
      className={cn(clases, 'transition-colors hover:border-[#DCCBEC] hover:bg-[#FCFAFE]')}
    >
      {contenido}
    </Link>
  ) : (
    <div role="group" aria-label={etiqueta} className={clases}>
      {contenido}
    </div>
  )
}

function IlustracionColegio() {
  return (
    <svg viewBox="0 0 460 260" fill="none" aria-hidden="true" className="h-auto w-full">
      <defs>
        <linearGradient
          id="portal-familia-colegio"
          x1="230"
          y1="70"
          x2="230"
          y2="230"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#B392D1" stopOpacity="0.9" />
          <stop offset="1" stopColor="#7B5AA6" stopOpacity="0.4" />
        </linearGradient>
      </defs>
      <ellipse cx="238" cy="236" rx="190" ry="18" fill="#8E6BB8" opacity="0.22" />
      <g fill="#8B67B5" opacity="0.55">
        <rect x="48" y="150" width="10" height="80" rx="3" />
        <circle cx="53" cy="128" r="32" />
        <circle cx="34" cy="150" r="24" />
        <circle cx="74" cy="150" r="24" />
        <rect x="396" y="158" width="9" height="72" rx="3" />
        <circle cx="401" cy="138" r="28" />
        <circle cx="384" cy="158" r="20" />
        <circle cx="418" cy="158" r="20" />
      </g>
      <g opacity="0.82">
        <path d="M150 226V120l80-48 80 48v106" fill="url(#portal-familia-colegio)" />
        <path d="M150 120l80-48 80 48" stroke="#D6C3E8" strokeWidth="2" fill="none" />
        <rect x="176" y="146" width="26" height="30" rx="3" fill="#5C3F82" />
        <rect x="258" y="146" width="26" height="30" rx="3" fill="#5C3F82" />
        <rect x="216" y="170" width="28" height="56" rx="4" fill="#4E346F" />
        <path d="M230 74V44" stroke="#D6C3E8" strokeWidth="2" />
        <path d="M232 44l26 8-26 9z" fill="#C9A7E8" />
        <rect x="112" y="176" width="42" height="50" rx="3" fill="#9B7BBF" opacity="0.7" />
        <rect x="306" y="176" width="42" height="50" rx="3" fill="#9B7BBF" opacity="0.7" />
      </g>
    </svg>
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

  return (
    <section className="relative isolate flex w-full flex-col">
      <PortalFamiliaWatermark />
      <PortalFamiliaShell
        titulo={<>{saludo ? `Hola, ${saludo}` : 'Hola'} 👋</>}
        tituloClassName="text-[32px] sm:text-[40px]"
        descripcion="Este es el resumen de tu familia en ESSERI."
        ilustracion={<IlustracionColegio />}
        className="pb-8"
        anchoMaximo="max-w-[92vw]"
      />

      <div className="relative mx-auto flex w-full max-w-[92vw] flex-col gap-5">
        <div className="flex flex-col gap-5">
          <div className="grid gap-3 sm:grid-cols-3">
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

          {pendientesJustificar !== null && pendientesJustificar > 0 && (
            <PortalAlertBanner
              titulo={
                pendientesJustificar === 1
                  ? 'Tenés una ausencia pendiente'
                  : `Tenés ${pendientesJustificar} ausencias pendientes`
              }
              descripcion="Podés justificarla desde el portal."
              className="items-center gap-3 p-3 sm:p-3"
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
            tituloClassName="font-heading text-[20px] font-bold tracking-[-0.01em] text-[#2B2338]"
            headerClassName="border-b border-[#F1EBF7] px-5 py-4"
            contentClassName="px-4 py-3"
          >
            {cargandoAlumnos ? (
              <Skeleton className="h-28 w-full bg-[#F0EAF7]" />
            ) : alumnos.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-[#F0E4FA] text-[#7A2FA8]">
                  <UsersIcon aria-hidden="true" className="size-6" />
                </span>
                <p className={cn('text-[15px] font-semibold', TINTA)}>
                  No encontramos alumnos vinculados a tu cuenta.
                </p>
                <p className={cn('max-w-[280px] text-[14px]', TINTA_2)}>
                  Comunicate con el colegio para vincular tu cuenta.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-4">
                {alumnos.map((alumno) => (
                  <li
                    key={alumno.alumno_id}
                    className="rounded-[14px] border border-[#EFE9F6] bg-white px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#E7D4F7] text-[14px] font-semibold text-[#7A2FA8]">
                        {iniciales(alumno.nombre, alumno.apellido)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn('truncate text-[16px] leading-tight font-semibold', TINTA)}
                        >
                          {alumno.apellido}, {alumno.nombre}
                        </p>
                        <p className={cn('mt-0.5 text-[13px]', TINTA_2)}>
                          {alumno.division_etiqueta ?? 'Curso no informado'}
                        </p>
                      </div>
                      <div className="flex w-full flex-wrap items-center gap-1 sm:w-auto">
                        <Link
                          to="/familia/asistencias"
                          className={cn(
                            'inline-flex min-h-9 items-center gap-1.5 rounded-full px-2 text-[14px] font-semibold',
                            ENLACE_VIOLETA,
                          )}
                        >
                          <CalendarClockIcon aria-hidden="true" className="size-4" />
                          Asistencias
                        </Link>
                        <span aria-hidden="true" className="h-4 w-px bg-[#E4DBEE]" />
                        <Link
                          to={`/familia/facturacion?alumno=${alumno.alumno_id}`}
                          className={cn(
                            'inline-flex min-h-9 items-center gap-1.5 rounded-full px-2 text-[14px] font-semibold',
                            ENLACE_VIOLETA,
                          )}
                        >
                          <ReceiptTextIcon aria-hidden="true" className="size-4" />
                          Facturación
                        </Link>
                        <span aria-hidden="true" className="h-4 w-px bg-[#E4DBEE]" />
                        <Link
                          to={`/familia/calendario?alumno=${alumno.alumno_id}`}
                          className={cn(
                            'inline-flex min-h-9 items-center gap-1.5 rounded-full px-2 text-[14px] font-semibold',
                            ENLACE_VIOLETA,
                          )}
                        >
                          <CalendarDaysIcon aria-hidden="true" className="size-4" />
                          Horario
                        </Link>
                      </div>
                      <ChevronRightIcon
                        aria-hidden="true"
                        className="hidden size-4 shrink-0 text-[#6B6478] sm:block"
                      />
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
                <div className="border-t border-[#F1EBF7] pt-3">
                  <p className="text-[13px] font-medium text-[#6B6478]">
                    {saldoAFavor ? 'Saldo a favor' : 'Saldo pendiente'}
                  </p>
                  {facturacion.cargando ? (
                    <Skeleton className="mt-2 h-8 w-28 bg-[#EEF4EE]" />
                  ) : (
                    <p
                      className={cn(
                        'mt-1 font-heading text-[30px] leading-none font-bold tabular-nums',
                        TINTA,
                      )}
                    >
                      {facturacion.cuenta ? formatearMoneda(Math.abs(saldoCuenta ?? 0)) : '-'}
                    </p>
                  )}
                  {facturacion.cargando ? (
                    <Skeleton className="mt-3 h-5 w-32 bg-[#EEF4EE]" />
                  ) : facturacion.cuenta ? (
                    <p
                      className={cn(
                        'mt-3 inline-flex items-center gap-1.5 text-[14px] font-medium',
                        facturasVencidas > 0 ? 'text-[#B42318]' : 'text-[#3E7B45]',
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
                    'mt-4 flex min-h-11 items-center justify-between border-t border-[#F1EBF7] pt-3 text-[15px] font-semibold',
                    ENLACE_VIOLETA,
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
