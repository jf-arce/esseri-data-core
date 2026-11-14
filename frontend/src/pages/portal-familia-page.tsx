import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRightIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  CalendarPlusIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  LayoutGridIcon,
  MailIcon,
  ReceiptTextIcon,
  UsersIcon,
} from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PortalFamiliaShell } from '@/components/portal-familia/portal-familia-shell'
import {
  PORTAL_PRIMARY_BUTTON_CLASS,
  PortalAlertBanner,
  PortalCard,
  PortalStatTile,
} from '@/components/portal-familia/portal-familia-ui'
import { useMisAlumnos } from '@/modules/familias-alumnos/hooks/use-mis-alumnos'
import { listarComunicaciones } from '@/modules/comunicaciones/services/listar-comunicaciones'
import { listarAsistenciasFamilia } from '@/modules/academico/services/listar-asistencias-familia'
import { esAusenciaPendienteDeJustificar } from '@/modules/academico/utils'
import { listarFacturacionFamilia } from '@/modules/facturacion/services/listar-facturacion-familia'
import { formatearMoneda } from '@/modules/facturacion/utils'
import type { FacturacionFamilia } from '@/modules/facturacion/types'
import { nombreDeUsuario } from '@/modules/auth/utils'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'

const TINTA = 'text-[#2B2338]'
const TINTA_2 = 'text-[#6B6478]'
const ENLACE_VIOLETA = 'text-[#7A2FA8] hover:text-[#6A2494]'

const ACCESOS_RAPIDOS = [
  { to: '/familia/calendario', label: 'Calendario', Icon: CalendarDaysIcon },
  { to: '/familia/facturacion', label: 'Mi cuenta', Icon: ReceiptTextIcon },
  { to: '/familia/asistencias', label: 'Asistencias', Icon: CalendarClockIcon },
  { to: '/familia/informar-ausencia', label: 'Informar ausencia', Icon: CalendarPlusIcon },
] as const

function iniciales(nombre: string, apellido: string) {
  return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase()
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
    Promise.all(alumnos.map((alumno) => listarAsistenciasFamilia(alumno.alumno_id)))
      .then((listas) => {
        if (!activo) return
        setAsistencias({
          total: listas.flat().filter((asistencia) => esAusenciaPendienteDeJustificar(asistencia))
            .length,
          cargando: false,
        })
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
    <section className="flex w-full flex-col">
      <PortalFamiliaShell
        titulo={<>{saludo ? `Hola, ${saludo}` : 'Hola'} 👋</>}
        tituloClassName="text-[32px] sm:text-[40px]"
        descripcion="Este es el resumen de tu familia en ESSERI."
        ilustracion={<IlustracionColegio />}
        className="pb-36"
        anchoMaximo="max-w-[92vw]"
      />

      <div className="relative mx-auto -mt-28 w-full max-w-[92vw]">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <PortalStatTile
                ariaLabel="Alumnos vinculados"
                label="Alumnos"
                detalle="Vinculados"
                value={alumnos.length}
                icon={UsersIcon}
                tone="lavanda"
                cargando={cargandoAlumnos}
              />
              <PortalStatTile
                ariaLabel="Asistencias sin justificar"
                label="Asistencias"
                detalle="Sin justificar"
                value={cargandoAsistencias ? '-' : (pendientesJustificar ?? '-')}
                icon={CalendarClockIcon}
                tone="ambar"
                cargando={cargandoAsistencias}
              />
              <PortalStatTile
                ariaLabel="Mensajes sin leer"
                label="Mensajes"
                detalle="Sin leer"
                value={sinLeer.cargando ? '-' : (sinLeer.total ?? '-')}
                icon={MailIcon}
                tone="azul"
                cargando={sinLeer.cargando}
              />
            </div>

            {pendientesJustificar !== null && pendientesJustificar > 0 && (
              <PortalAlertBanner
                titulo={
                  pendientesJustificar === 1
                    ? 'Tenés una ausencia pendiente'
                    : `Tenés ${pendientesJustificar} ausencias pendientes`
                }
                descripcion="Podés informar el motivo de la ausencia desde el portal."
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

            <PortalCard
              titulo="Mis alumnos"
              descripcion="Accedé a la información y gestiones de cada alumno."
              tituloClassName="font-heading text-[24px] font-bold tracking-[-0.01em] text-[#2B2338]"
              headerClassName="border-b border-[#F1EBF7] px-6 py-6"
              contentClassName="px-6 py-5"
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
                      className="rounded-[16px] border border-[#F0EAF6] bg-[#FBF9FD] px-4 pt-4"
                    >
                      <div className="flex items-center gap-4">
                        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#E7D4F7] text-[15px] font-semibold text-[#7A2FA8]">
                          {iniciales(alumno.nombre, alumno.apellido)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              'truncate text-[17px] leading-tight font-semibold',
                              TINTA,
                            )}
                          >
                            {alumno.apellido}, {alumno.nombre}
                          </p>
                          <p className={cn('mt-1 text-[14px]', TINTA_2)}>
                            {alumno.division_etiqueta ?? 'Curso no informado'}
                          </p>
                        </div>
                        <ChevronRightIcon
                          aria-hidden="true"
                          className="size-5 shrink-0 text-[#6B6478]"
                        />
                      </div>
                      <div className="mt-3 flex items-center border-t border-[#EEE6F5] pt-1">
                        <Link
                          to="/familia/asistencias"
                          className={cn(
                            'inline-flex min-h-10 flex-1 items-center justify-center gap-2 py-2 text-[15px] font-semibold',
                            ENLACE_VIOLETA,
                          )}
                        >
                          <CalendarClockIcon aria-hidden="true" className="size-[18px]" />
                          Asistencias
                        </Link>
                        <span aria-hidden="true" className="h-5 w-px bg-[#E4DBEE]" />
                        <Link
                          to={`/familia/facturacion?alumno=${alumno.alumno_id}`}
                          className={cn(
                            'inline-flex min-h-10 flex-1 items-center justify-center gap-2 py-2 text-[15px] font-semibold',
                            ENLACE_VIOLETA,
                          )}
                        >
                          <ReceiptTextIcon aria-hidden="true" className="size-[18px]" />
                          Facturación
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </PortalCard>
          </div>

          <aside className="flex min-w-0 flex-col gap-6">
            <PortalCard
              icono={ReceiptTextIcon}
              tone="verde"
              titulo="Facturación"
              descripcion="Estado general de la cuenta familiar."
              className="bg-[#F0F6F1]"
            >
              <div className="flex flex-col gap-3">
                <p className="text-xs font-medium text-[#6B6478]">
                  {saldoAFavor ? 'Saldo a favor' : 'Saldo pendiente'}
                </p>
                {facturacion.cargando ? (
                  <Skeleton className="h-8 w-28 bg-[#DCE7DD]" />
                ) : (
                  <p
                    className={cn(
                      'font-heading text-[26px] leading-none font-bold tabular-nums',
                      TINTA,
                    )}
                  >
                    {facturacion.cuenta ? formatearMoneda(Math.abs(saldoCuenta ?? 0)) : '-'}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {facturacion.cargando ? (
                    <Skeleton className="h-5 w-32 bg-[#DCE7DD]" />
                  ) : facturacion.cuenta ? (
                    <p
                      className={cn(
                        'inline-flex items-center gap-1.5 text-[14px] font-medium',
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
                  <Link
                    to="/familia/facturacion"
                    className={cn(
                      'inline-flex min-h-9 items-center gap-1 text-[14px] font-semibold',
                      ENLACE_VIOLETA,
                    )}
                  >
                    Ver facturación
                    <ChevronRightIcon aria-hidden="true" className="size-4" />
                  </Link>
                </div>
              </div>
            </PortalCard>

            <PortalCard
              icono={MailIcon}
              tone="azul"
              titulo="Comunicaciones"
              descripcion="Avisos y mensajes del colegio."
              className="bg-[#EDF1FE]"
            >
              <div className="flex items-end justify-between gap-3">
                {sinLeer.cargando ? (
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-7 w-10 bg-[#D7E4F8]" />
                    <Skeleton className="h-4 w-24 bg-[#E1EBFA]" />
                  </div>
                ) : sinLeer.total === null ? (
                  <p className={cn('text-[15px]', TINTA_2)}>-</p>
                ) : sinLeer.total > 0 ? (
                  <p className="leading-tight">
                    <span
                      className={cn('block font-heading text-[26px] font-bold tabular-nums', TINTA)}
                    >
                      {sinLeer.total}
                    </span>
                    <span className={cn('text-[14px]', TINTA_2)}>
                      {sinLeer.total === 1 ? 'mensaje sin leer' : 'mensajes sin leer'}
                    </span>
                  </p>
                ) : (
                  <p className={cn('text-[14px]', TINTA_2)}>Estás al día.</p>
                )}
                <Link
                  to="/familia/comunicaciones"
                  className={cn(
                    'inline-flex min-h-9 shrink-0 items-center gap-1 text-[14px] font-semibold',
                    ENLACE_VIOLETA,
                  )}
                >
                  Ver mensajes
                  <ChevronRightIcon aria-hidden="true" className="size-4" />
                </Link>
              </div>
            </PortalCard>

            <PortalCard
              icono={LayoutGridIcon}
              tone="lavanda"
              titulo="Accesos rápidos"
              descripcion="Otras gestiones frecuentes."
            >
              <div className="flex flex-col gap-2">
                {ACCESOS_RAPIDOS.map(({ to, label, Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    className="flex min-h-14 items-center gap-3 rounded-[12px] border border-[#EFE9F6] bg-[#FBF9FE] px-3 py-2.5 transition-colors hover:border-[#E3D6F0] hover:bg-[#F7F2FC]"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[#EADCF8] text-[#7A2FA8]">
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <span className={cn('min-w-0 flex-1 text-[15px] font-medium', TINTA)}>
                      {label}
                    </span>
                    <ChevronRightIcon
                      aria-hidden="true"
                      className="size-4 shrink-0 text-[#6B6478]"
                    />
                  </Link>
                ))}
              </div>
            </PortalCard>
          </aside>
        </div>
      </div>
    </section>
  )
}
