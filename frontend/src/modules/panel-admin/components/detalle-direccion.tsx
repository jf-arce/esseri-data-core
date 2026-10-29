import type { ReactNode } from 'react'
import { Link } from 'react-router'
import {
  ArrowLeftRightIcon,
  ArrowUpRightIcon,
  CheckCircle2Icon,
  CircleDollarSignIcon,
  ClipboardListIcon,
  Clock3Icon,
  FileTextIcon,
  PackageCheckIcon,
  TriangleAlertIcon,
  UserMinusIcon,
  UserPlusIcon,
  XCircleIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { formatearMoneda } from '@/modules/facturacion/utils'
import type { EstadoSolicitud } from '@/modules/proveedores-compras/types'
import { useDetalleDireccion, type Recurso } from '../hooks/use-detalle-direccion'
import { fechaActividad } from '../utils'
import type { ActividadReciente, CategoriaActividad } from '../services/obtener-actividad-reciente'
import { GraficoAsistencia, GraficoFinanciero } from './graficos-direccion'

function Panel({
  titulo,
  detalle,
  children,
}: {
  titulo: string
  detalle?: string
  children: ReactNode
}) {
  return (
    <Card size="sm" className="w-full min-w-0 self-start gap-3">
      <CardHeader>
        <h2 className="text-base font-semibold leading-snug">{titulo}</h2>
        {detalle && <p className="text-xs text-texto-2">{detalle}</p>}
      </CardHeader>
      <CardContent className="@container space-y-3">{children}</CardContent>
    </Card>
  )
}

function Estado<T>({
  recurso,
  vacio,
  children,
}: {
  recurso: Recurso<T>
  vacio: boolean
  children: ReactNode
}) {
  if (recurso.cargando)
    return (
      <div role="status" aria-label="Cargando sección" className="space-y-3">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  if (recurso.error)
    return (
      <p role="alert" className="py-4 text-sm text-error">
        {recurso.error}
      </p>
    )
  if (vacio) return <p className="py-5 text-sm text-texto-2">No hay registros para mostrar.</p>
  return children
}

// Todo acceso que sale de este panel se ve como botón y no como link de texto: el destino es
// otra pantalla, y el botón lo hace evidente sin depender de un subrayado al hover.
function Acceso({ to, children, label }: { to: string; children: ReactNode; label?: string }) {
  return (
    <Button asChild className="h-10">
      <Link to={to} aria-label={label}>
        {children}
        <ArrowUpRightIcon data-icon="inline-end" aria-hidden="true" />
      </Link>
    </Button>
  )
}

// En "Requiere tu atención" el estado `pendiente` es justamente lo que exige una decisión de
// Dirección, así que acá usa `advertencia` y no el `neutro` de la tabla de Compras (donde
// significa "sin decisión", no una alerta). Sin ícono: el badge semántico ya comunica con
// punto + texto, y un ícono adentro suma ruido (DESIGN.md §9).
const VARIANTE_ESTADO_COMPRA = {
  aprobada: 'exito',
  rechazada: 'error',
  pendiente: 'advertencia',
} as const

const ETIQUETA_ESTADO_COMPRA: Record<EstadoSolicitud, string> = {
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  pendiente: 'Pendiente',
}

function EstadoCompra({ estado }: { estado: EstadoSolicitud }) {
  return <Badge variant={VARIANTE_ESTADO_COMPRA[estado]}>{ETIQUETA_ESTADO_COMPRA[estado]}</Badge>
}

const fecha = (valor: string) =>
  new Date(`${valor.slice(0, 10)}T12:00:00`).toLocaleDateString('es-AR')

const ICONO_ACTIVIDAD = {
  solicitud_compra_creada: ClipboardListIcon,
  solicitud_compra_aprobada: CheckCircle2Icon,
  solicitud_compra_rechazada: XCircleIcon,
  orden_compra_emitida: FileTextIcon,
  recepcion_compra_registrada: PackageCheckIcon,
  pago_registrado: CircleDollarSignIcon,
  factura_vencida: TriangleAlertIcon,
  matricula_alta: UserPlusIcon,
  matricula_baja: UserMinusIcon,
  cambio_matricula: ArrowLeftRightIcon,
} as const

const TINTE_CATEGORIA: Record<CategoriaActividad, string> = {
  compras: 'bg-sup-compras text-mod-compras',
  finanzas: 'bg-sup-facturacion text-mod-facturacion',
  alumnos: 'bg-sup-familias text-mod-familias',
}

const ESTADO_ACTIVIDAD: Record<
  string,
  { etiqueta: string; variante: 'exito' | 'advertencia' | 'error' | 'info' | 'neutro' }
> = {
  pendiente: { etiqueta: 'Pendiente', variante: 'advertencia' },
  aprobada: { etiqueta: 'Aprobada', variante: 'exito' },
  rechazada: { etiqueta: 'Rechazada', variante: 'error' },
  emitida: { etiqueta: 'Emitida', variante: 'info' },
  recibida: { etiqueta: 'Recibida', variante: 'exito' },
  registrado: { etiqueta: 'Registrado', variante: 'exito' },
  vencida: { etiqueta: 'Vencida', variante: 'error' },
  alta: { etiqueta: 'Alta', variante: 'exito' },
  baja: { etiqueta: 'Baja', variante: 'neutro' },
  cambio: { etiqueta: 'Cambio', variante: 'info' },
}

function EstadoActividad({ estado }: { estado: string | null }) {
  if (!estado) return null
  const configuracion = ESTADO_ACTIVIDAD[estado]
  if (!configuracion) return null
  return <Badge variant={configuracion.variante}>{configuracion.etiqueta}</Badge>
}

function FilaActividad({ item }: { item: ActividadReciente }) {
  const Icono = ICONO_ACTIVIDAD[item.tipo as keyof typeof ICONO_ACTIVIDAD] ?? Clock3Icon
  const contexto = [item.referencia, item.detalle].filter(Boolean).join(' · ')
  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1 py-3">
      <span
        className={`flex size-8 items-center justify-center rounded-lg ${TINTE_CATEGORIA[item.categoria]}`}
      >
        <Icono className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="break-words font-medium leading-snug">{item.titulo}</p>
        {(contexto || item.monto) && (
          <p className="mt-0.5 break-words text-xs text-texto-2">
            {contexto}
            {contexto && item.monto ? ' · ' : ''}
            {item.monto ? formatearMoneda(item.monto) : ''}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <EstadoActividad estado={item.estado} />
          <time dateTime={item.ocurrido_en} className="text-xs tabular-nums text-texto-2">
            {fechaActividad(item.ocurrido_en)}
          </time>
        </div>
      </div>
    </li>
  )
}

export function DetalleDireccion({
  acceso,
}: {
  acceso: { compras: boolean; finanzas: boolean; academico: boolean; alumnos: boolean }
}) {
  const datos = useDetalleDireccion(acceso)
  const pendientes = datos.compras.datos?.filter((item) => item.estado === 'pendiente') ?? []
  const meses = datos.finanzas.datos ?? []
  const dias = new Map<string, { presentes: number; total: number }>()
  for (const item of datos.asistencia.datos ?? []) {
    const dia = dias.get(item.fecha) ?? { presentes: 0, total: 0 }
    dia.total++
    if (item.tipo === 'presente' || item.tipo === 'tardanza') dia.presentes++
    dias.set(item.fecha, dia)
  }
  const serie = [...dias].sort(([a], [b]) => a.localeCompare(b))
  return (
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-4">
        {(acceso.compras || acceso.finanzas) && (
          <Panel
            titulo="Requiere tu atención"
            detalle="Pendientes de gestión y cuentas con deuda vencida"
          >
            <Tabs defaultValue={acceso.compras ? 'compras' : 'deudas'}>
              <TabsList className="h-auto flex-wrap gap-x-3 gap-y-1 group-data-horizontal/tabs:h-auto">
                {acceso.compras && (
                  <TabsTrigger value="compras" className="mr-0">
                    Solicitudes de compra
                    {!datos.compras.cargando && !datos.compras.error && datos.compras.datos
                      ? ` (${pendientes.length})`
                      : ''}
                  </TabsTrigger>
                )}
                {acceso.finanzas && (
                  <TabsTrigger value="deudas" className="mr-0">
                    Cuentas en mora{datos.deudas.datos ? ` (${datos.deudas.datos.total})` : ''}
                  </TabsTrigger>
                )}
              </TabsList>
              {acceso.compras && (
                <TabsContent value="compras">
                  <Estado recurso={datos.compras} vacio={!pendientes.length}>
                    <table className="w-full table-fixed text-left text-sm">
                      <caption className="sr-only">
                        Solicitudes de compra pendientes, últimas cinco
                      </caption>
                      <thead className="text-xs text-texto-2">
                        <tr>
                          <th className="hidden w-24 py-3 font-medium @xl:table-cell">Fecha</th>
                          <th className="py-3 pr-3 font-medium">Solicitud</th>
                          <th className="w-28 font-medium">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...pendientes]
                          .sort((a, b) => b.fecha.localeCompare(a.fecha))
                          .slice(0, 5)
                          .map((item) => (
                            <tr key={item.id} className="border-t border-borde">
                              <td className="hidden py-3 pr-3 text-xs tabular-nums text-texto-2 @xl:table-cell">
                                {fecha(item.fecha)}
                              </td>
                              <td className="py-3 pr-3">
                                <p className="break-words font-medium leading-snug">
                                  {item.articulo || 'Solicitud de producto del catálogo'}
                                </p>
                                <p className="mt-1 break-words text-xs text-texto-2">
                                  {item.area_solicitante || 'Sin área indicada'} · {item.cantidad}{' '}
                                  {item.cantidad === 1 ? 'unidad' : 'unidades'}
                                  <span className="block tabular-nums @xl:hidden">
                                    {fecha(item.fecha)}
                                  </span>
                                </p>
                              </td>
                              <td>
                                <EstadoCompra estado={item.estado} />
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </Estado>
                  <div className="flex flex-wrap items-center justify-between gap-x-3 border-t border-borde pt-2">
                    {pendientes.length > 5 && (
                      <p className="text-xs text-texto-2">
                        Mostrando las 5 pendientes más recientes
                      </p>
                    )}
                    <Acceso to="/solicitudes-compra">Revisar solicitudes</Acceso>
                  </div>
                </TabsContent>
              )}
              {acceso.finanzas && (
                <TabsContent value="deudas">
                  <Estado recurso={datos.deudas} vacio={!datos.deudas.datos?.items.length}>
                    <ul className="divide-y divide-borde">
                      {datos.deudas.datos?.items.map((item) => (
                        <li
                          key={item.familia_id}
                          className="flex flex-wrap items-center justify-between gap-2 py-3"
                        >
                          <div>
                            <p className="font-medium">
                              {item.familia_apellido}, {item.familia_nombre}
                            </p>
                            <p className="text-xs text-texto-2">Deuda vencida</p>
                          </div>
                          <span className="font-semibold tabular-nums text-error">
                            {formatearMoneda(item.monto_vencido)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Estado>
                  <Acceso to="/facturacion/deudas/familias">Ver cuentas por familia</Acceso>
                </TabsContent>
              )}
            </Tabs>
          </Panel>
        )}
        {acceso.academico && (
          <Panel titulo="Asistencia" detalle="Últimos 30 días · registros cargados">
            <Estado recurso={datos.asistencia} vacio={!serie.length}>
              {serie.length > 0 && <GraficoAsistencia serie={serie} />}
            </Estado>
            <div className="border-t border-borde pt-1">
              <Acceso to="/academico/historial-asistencia">Ver asistencias</Acceso>
            </div>
          </Panel>
        )}
      </div>
      <div className="min-w-0 space-y-4">
        {acceso.finanzas && (
          <Panel
            titulo="Evolución financiera"
            detalle="Facturación emitida y cobros aprobados del año en curso"
          >
            <Estado
              recurso={datos.finanzas}
              vacio={!meses.some((mes) => Number(mes.facturado) || Number(mes.cobrado))}
            >
              <GraficoFinanciero meses={meses} />
            </Estado>
            <div className="border-t border-borde pt-1">
              <Acceso to="/facturacion">Abrir facturación</Acceso>
            </div>
          </Panel>
        )}
        {(acceso.compras || acceso.finanzas || acceso.alumnos) && (
          <Panel
            titulo="Actividad reciente"
            detalle="Hechos registrados de compras, finanzas y alumnado"
          >
            <Estado recurso={datos.actividad} vacio={!datos.actividad.datos?.length}>
              <ul aria-label="Actividad reciente" className="divide-y divide-borde">
                {datos.actividad.datos?.map((item) => (
                  <FilaActividad key={item.id} item={item} />
                ))}
              </ul>
            </Estado>
          </Panel>
        )}
      </div>
    </div>
  )
}
