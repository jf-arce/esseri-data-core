import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
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
import { cn } from '@/lib/utils'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatearMoneda } from '@/modules/facturacion/utils'
import type { DatosDetalleDireccion } from '../hooks/use-detalle-direccion'
import { fechaActividad } from '../utils'
import type { ActividadReciente, CategoriaActividad } from '../services/obtener-actividad-reciente'
import { AtencionDireccion } from './atencion-direccion'
import { Estado } from './estado-recurso'
import { GraficoAsistencia, GraficoFinanciero } from './graficos-direccion'

function Panel({
  titulo,
  accion,
  fijo,
  children,
  className,
  contenidoClassName,
}: {
  titulo: string
  accion?: ReactNode
  // Contenido que queda fijo arriba mientras el cuerpo de la card hace scroll.
  fijo?: ReactNode
  children: ReactNode
  className?: string
  contenidoClassName?: string
}) {
  return (
    <Card className={cn('h-full w-full min-w-0', className)}>
      <CardHeader className="items-start">
        <CardTitle>
          <h2>{titulo}</h2>
        </CardTitle>
        {accion && <CardAction className="row-span-1 self-start">{accion}</CardAction>}
      </CardHeader>
      {fijo && <div className="px-(--card-spacing)">{fijo}</div>}
      <CardContent className={cn('@container flex flex-1 flex-col gap-3', contenidoClassName)}>
        {children}
      </CardContent>
    </Card>
  )
}

// El destino es otra pantalla, así que se ve como botón; pero secundario: en esta pantalla
// ningún acceso compite con los datos (§9, un solo primario por vista como máximo).
function Acceso({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Button asChild variant="secondary" size="sm" className="min-h-9">
      <Link to={to}>
        {children}
        <ArrowUpRightIcon data-icon="inline-end" aria-hidden="true" />
      </Link>
    </Button>
  )
}

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

// El feed no trae el id de la entidad, así que cada hecho lleva a la pantalla de su módulo.
const RUTA_ACTIVIDAD: Record<string, string> = {
  solicitud_compra_creada: '/solicitudes-compra',
  solicitud_compra_aprobada: '/solicitudes-compra',
  solicitud_compra_rechazada: '/solicitudes-compra',
  orden_compra_emitida: '/ordenes-compra',
  recepcion_compra_registrada: '/ordenes-compra',
  pago_registrado: '/facturacion',
  factura_vencida: '/facturacion/deudas/familias',
  matricula_alta: '/inscripciones',
  matricula_baja: '/inscripciones',
  cambio_matricula: '/inscripciones',
}

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

function FilaActividad({ item, ultimo }: { item: ActividadReciente; ultimo: boolean }) {
  const Icono = ICONO_ACTIVIDAD[item.tipo as keyof typeof ICONO_ACTIVIDAD] ?? Clock3Icon
  const ruta = RUTA_ACTIVIDAD[item.tipo]
  const contexto = [item.referencia, item.detalle].filter(Boolean).join(' · ')
  return (
    <li
      className={`relative grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1 ${ultimo ? '' : 'pb-5'}`}
    >
      {/* Riel (§13): la línea nace en el centro del tile (2rem / 2 = 1rem) y baja hasta el siguiente. */}
      {!ultimo && (
        <span
          aria-hidden="true"
          className="absolute top-9 -bottom-1 left-4 w-px -translate-x-1/2 bg-borde"
        />
      )}
      <span
        className={`relative flex size-8 items-center justify-center rounded-lg ${TINTE_CATEGORIA[item.categoria]}`}
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
          {ruta && (
            <Link
              to={ruta}
              aria-label={`Ver ${item.titulo.toLowerCase()}`}
              className="text-xs font-semibold text-violeta underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-violeta"
            >
              Ver detalle
            </Link>
          )}
        </div>
      </div>
    </li>
  )
}

const FILTROS_ACTIVIDAD: { valor: CategoriaActividad | 'todas'; etiqueta: string }[] = [
  { valor: 'todas', etiqueta: 'Todo' },
  { valor: 'compras', etiqueta: 'Compras' },
  { valor: 'finanzas', etiqueta: 'Finanzas' },
  { valor: 'alumnos', etiqueta: 'Alumnos' },
]

function FiltroActividad({
  activo,
  categorias,
  onChange,
}: {
  activo: CategoriaActividad | 'todas'
  categorias: Set<CategoriaActividad>
  onChange: (valor: CategoriaActividad | 'todas') => void
}) {
  // Solo se ofrecen las categorías que el rol ve y que tienen hechos en la lista.
  const visibles = FILTROS_ACTIVIDAD.filter((f) => f.valor === 'todas' || categorias.has(f.valor))
  if (visibles.length < 3) return null
  return (
    <Tabs value={activo} onValueChange={(valor) => onChange(valor as typeof activo)}>
      <TabsList aria-label="Filtrar actividad">
        {visibles.map(({ valor, etiqueta }) => (
          <TabsTrigger key={valor} value={valor}>
            {etiqueta}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

export function DetalleDireccion({
  acceso,
  datos,
}: {
  acceso: { compras: boolean; finanzas: boolean; academico: boolean; alumnos: boolean }
  datos: DatosDetalleDireccion
}) {
  const navegar = useNavigate()
  const [filtro, setFiltro] = useState<CategoriaActividad | 'todas'>('todas')
  const eventos = datos.actividad.datos ?? []
  const visibles = eventos.filter((item) => filtro === 'todas' || item.categoria === filtro)
  const meses = datos.finanzas.datos ?? []
  const dias = new Map<string, { presentes: number; total: number }>()
  for (const item of datos.asistencia.datos ?? []) {
    const dia = dias.get(item.fecha) ?? { presentes: 0, total: 0 }
    dia.total++
    if (item.tipo === 'presente' || item.tipo === 'tardanza') dia.presentes++
    dias.set(item.fecha, dia)
  }
  const serie = [...dias].sort(([a], [b]) => a.localeCompare(b))
  const hayAtencion = acceso.compras || acceso.finanzas
  const hayActividad = acceso.compras || acceso.finanzas || acceso.alumnos
  // Bento de 12 columnas: 8/4 arriba y 4/8 abajo, para que los anchos se alternen en vez de
  // repetir dos columnas iguales. Si falta la pareja de una celda, ocupa todo el ancho.
  const ancho = (principal: boolean, pareja: boolean, grande: string, chico: string) =>
    pareja ? (principal ? grande : chico) : 'xl:col-span-12'
  return (
    <div className="grid min-w-0 items-stretch gap-6 xl:grid-cols-12">
      {hayAtencion && (
        <div className={cn('min-w-0', ancho(true, hayActividad, 'xl:col-span-8', 'xl:col-span-4'))}>
          <AtencionDireccion
            compras={datos.compras}
            deudas={datos.deudas}
            acceso={{ compras: acceso.compras, finanzas: acceso.finanzas }}
          />
        </div>
      )}
      {hayActividad && (
        // En escritorio la card toma la altura de "Requiere tu atención" (`xl:h-0 xl:min-h-full`
        // la saca del cálculo de la fila) y la lista hace scroll adentro si hay muchos eventos.
        <div
          className={cn(
            'min-w-0',
            ancho(false, hayAtencion, 'xl:col-span-8', 'xl:col-span-4'),
            hayAtencion && 'xl:h-0 xl:min-h-full',
          )}
        >
          <Panel
            titulo="Actividad reciente"
            fijo={
              <FiltroActividad
                activo={filtro}
                categorias={new Set(eventos.map((item) => item.categoria))}
                onChange={setFiltro}
              />
            }
            contenidoClassName={cn(
              'min-h-0 flex-1 overflow-y-auto',
              hayAtencion ? 'max-h-96 xl:max-h-none' : 'max-h-[32rem]',
            )}
          >
            <Estado recurso={datos.actividad} vacio={!visibles.length}>
              <ul aria-label="Actividad reciente">
                {visibles.map((item, indice, lista) => (
                  <FilaActividad key={item.id} item={item} ultimo={indice === lista.length - 1} />
                ))}
              </ul>
            </Estado>
          </Panel>
        </div>
      )}
      {acceso.finanzas && (
        <div
          className={cn(
            'min-w-0 xl:order-4',
            ancho(true, acceso.academico, 'xl:col-span-8', 'xl:col-span-4'),
          )}
        >
          <Panel
            titulo="Evolución financiera"
            accion={<Acceso to="/facturacion">Abrir facturación</Acceso>}
          >
            <Estado
              recurso={datos.finanzas}
              vacio={!meses.length}
              carga={<GraficoFinanciero meses={[]} cargando />}
            >
              <GraficoFinanciero
                meses={meses}
                onMesClick={(mes) => navegar(`/facturacion?emision_mes=${mes}`)}
              />
            </Estado>
          </Panel>
        </div>
      )}
      {acceso.academico && (
        <div
          className={cn(
            'min-w-0 xl:order-3',
            ancho(false, acceso.finanzas, 'xl:col-span-8', 'xl:col-span-4'),
          )}
        >
          <Panel
            titulo="Asistencia · 30 días"
            accion={<Acceso to="/academico/historial-asistencia">Ver asistencias</Acceso>}
          >
            <Estado
              recurso={datos.asistencia}
              vacio={!serie.length}
              carga={<GraficoAsistencia serie={[]} cargando />}
            >
              {serie.length > 0 && (
                <GraficoAsistencia
                  serie={serie}
                  onDiaClick={(dia) => navegar(`/academico/historial-asistencia?fecha=${dia}`)}
                />
              )}
            </Estado>
          </Panel>
        </div>
      )}
    </div>
  )
}
