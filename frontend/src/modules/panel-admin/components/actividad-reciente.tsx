import { useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowLeftRightIcon,
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatearMoneda } from '@/modules/facturacion/utils'
import type { Recurso } from '../hooks/use-recurso'
import type { ActividadReciente, CategoriaActividad } from '../services/obtener-actividad-reciente'
import { fechaActividad } from '../utils'
import { Estado } from './estado-recurso'
import { Panel } from './panel-card'

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

// El feed no siempre trae el id de la entidad: cuando lo trae, el detalle abre el registro exacto
// (la factura vencida va a su ficha); si no, va a la pantalla del módulo.
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

function rutaActividad(item: ActividadReciente): string | null {
  if (item.tipo === 'factura_vencida' && item.entidad_id) {
    return `/facturacion/${item.entidad_id}`
  }
  return RUTA_ACTIVIDAD[item.tipo] ?? null
}

function FilaActividad({ item, ultimo }: { item: ActividadReciente; ultimo: boolean }) {
  const Icono = ICONO_ACTIVIDAD[item.tipo as keyof typeof ICONO_ACTIVIDAD] ?? Clock3Icon
  const ruta = rutaActividad(item)
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

/** Feed de hechos ya ocurridos, filtrable por categoría. Compartido por los dos paneles. */
export function PanelActividadReciente({
  recurso,
  contenidoClassName,
}: {
  recurso: Recurso<ActividadReciente[]>
  contenidoClassName?: string
}) {
  const [filtro, setFiltro] = useState<CategoriaActividad | 'todas'>('todas')
  const eventos = recurso.datos ?? []
  const visibles = eventos.filter((item) => filtro === 'todas' || item.categoria === filtro)
  return (
    <Panel
      titulo="Actividad reciente"
      fijo={
        <FiltroActividad
          activo={filtro}
          categorias={new Set(eventos.map((item) => item.categoria))}
          onChange={setFiltro}
        />
      }
      contenidoClassName={contenidoClassName}
    >
      <Estado recurso={recurso} vacio={!visibles.length}>
        <ul aria-label="Actividad reciente">
          {visibles.map((item, indice, lista) => (
            <FilaActividad key={item.id} item={item} ultimo={indice === lista.length - 1} />
          ))}
        </ul>
      </Estado>
    </Panel>
  )
}
