import type { ReactNode } from 'react'
import {
  CircleDollarSignIcon,
  ClipboardListIcon,
  UserRoundCheckIcon,
  UserRoundXIcon,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { StatTile } from '@/components/stat-tile'
import { formatearMoneda } from '@/modules/facturacion/utils'
import type { DeudaFamiliasListado } from '@/modules/facturacion/types'
import type { SolicitudCompra } from '@/modules/proveedores-compras/types'
import type { Recurso } from '../hooks/use-detalle-direccion'
import type { IndicadoresDireccion } from '../types'
import { antiguedad, diasDesde } from '../utils'

export interface AccesoIndicadores {
  alumnos: boolean
  facturacion: boolean
  academico: boolean
  compras: boolean
}

type Clave = 'deuda' | 'alumnos' | 'inasistencias' | 'solicitudes'

interface Tarjeta {
  clave: Clave
  label: string
  aria: string
  to: string
  icon: LucideIcon
  value: string | number
  note?: string
  iconClassName?: string
  desglose?: ReactNode
  // Mini detalle que se abre al pasar el mouse o enfocar la tarjeta.
  vistaPrevia?: ReactNode
}

const DIAS_DEMORA = 7
// El orden es la prioridad para elegir el indicador principal: el primero habilitado es el hero.
const ORDEN: Clave[] = ['deuda', 'alumnos', 'inasistencias', 'solicitudes']
// El hero ocupa dos columnas: una tarjeta más de columnas que de indicadores.
const COLUMNAS_XL = {
  1: 'xl:grid-cols-2',
  2: 'xl:grid-cols-3',
  3: 'xl:grid-cols-4',
  4: 'xl:grid-cols-5',
}

function Desglose({ items }: { items: { etiqueta: string; valor: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-4 border-t border-white/15 pt-4">
      {items.map(({ etiqueta, valor }) => (
        <div key={etiqueta}>
          <dt className="text-xs text-texto-2-sobre-oscuro">{etiqueta}</dt>
          <dd className="mt-0.5 text-base font-semibold tabular-nums text-texto-sobre-oscuro">
            {valor}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export interface ContextoVistaPrevia {
  deudas?: Recurso<DeudaFamiliasListado>
  compras?: Recurso<SolicitudCompra[]>
}

function VistaPrevia({
  titulo,
  filas,
}: {
  titulo: string
  filas: { clave: string; texto: string; valor: string; tono?: string }[]
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-texto-2">{titulo}</p>
      <ul className="mt-2 divide-y divide-borde">
        {filas.map((fila) => (
          <li key={fila.clave} className="flex items-baseline justify-between gap-3 py-1.5">
            <span className="min-w-0 truncate">{fila.texto}</span>
            <span className={`shrink-0 text-xs font-semibold tabular-nums ${fila.tono ?? ''}`}>
              {fila.valor}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-texto-3">Clic para ver el detalle completo</p>
    </div>
  )
}

function construirTarjetas(
  datos: IndicadoresDireccion,
  acceso: AccesoIndicadores,
  hero: Clave,
  ahora: Date,
  contexto: ContextoVistaPrevia,
): Tarjeta[] {
  const conRegistros = datos.asistencias_registradas_hoy > 0
  const diasPendiente = datos.solicitud_pendiente_mas_antigua
    ? diasDesde(datos.solicitud_pendiente_mas_antigua, ahora)
    : null
  const demorada = diasPendiente !== null && diasPendiente > DIAS_DEMORA
  const filasDeuda = [...(contexto.deudas?.datos?.items ?? [])]
    .sort((a, b) => Number(b.monto_vencido) - Number(a.monto_vencido))
    .slice(0, 3)
    .map((item) => ({
      clave: item.familia_id,
      texto: `${item.familia_apellido}, ${item.familia_nombre}`,
      valor: formatearMoneda(item.monto_vencido),
      tono: 'text-error',
    }))
  const filasSolicitudes = (contexto.compras?.datos ?? [])
    .filter((item) => item.estado === 'pendiente')
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(0, 3)
    .map((item) => ({
      clave: item.id,
      texto: item.articulo || 'Solicitud de producto del catálogo',
      valor: antiguedad(diasDesde(item.fecha, ahora)),
    }))
  const todas: Record<Clave, Tarjeta | null> = {
    deuda: acceso.facturacion
      ? {
          clave: 'deuda',
          label: 'Deuda vencida',
          aria: 'Ver facturas y deuda vencida',
          to: '/facturacion',
          icon: CircleDollarSignIcon,
          value: formatearMoneda(datos.deuda_vencida_total),
          iconClassName: 'bg-sup-facturacion text-mod-facturacion',
          vistaPrevia: filasDeuda.length ? (
            <VistaPrevia titulo="Mayores deudas vencidas" filas={filasDeuda} />
          ) : undefined,
          desglose: (
            <Desglose
              items={[
                {
                  etiqueta: 'Total pendiente',
                  valor: formatearMoneda(datos.deuda_pendiente_total),
                },
                { etiqueta: 'Familias en mora', valor: String(datos.familias_en_mora) },
              ]}
            />
          ),
        }
      : null,
    alumnos: acceso.alumnos
      ? {
          clave: 'alumnos',
          label: 'Alumnos activos',
          aria: 'Ver alumnos activos',
          to: '/familias-alumnos/alumnos',
          icon: UserRoundCheckIcon,
          value: datos.alumnos_activos,
          note: `+${datos.altas_mes} ${datos.altas_mes === 1 ? 'alta' : 'altas'} · ${datos.bajas_mes} ${datos.bajas_mes === 1 ? 'baja' : 'bajas'} este mes`,
        }
      : null,
    inasistencias: acceso.academico
      ? {
          clave: 'inasistencias',
          label: 'Inasistencias de hoy',
          aria: 'Ver inasistencias en Académico',
          to: '/academico',
          icon: UserRoundXIcon,
          value: datos.inasistencias_hoy,
          iconClassName: 'bg-sup-academico text-mod-academico',
          note: conRegistros
            ? `${Math.round((datos.inasistencias_hoy / datos.asistencias_registradas_hoy) * 100)} % de ${datos.asistencias_registradas_hoy} registros`
            : 'Sin registros cargados hoy',
        }
      : null,
    solicitudes: acceso.compras
      ? {
          clave: 'solicitudes',
          label: 'Solicitudes de compra pendientes',
          aria: 'Ver solicitudes de compra pendientes',
          to: '/solicitudes-compra',
          icon: ClipboardListIcon,
          value: datos.solicitudes_compra_pendientes,
          vistaPrevia: filasSolicitudes.length ? (
            <VistaPrevia titulo="Pendientes más antiguas" filas={filasSolicitudes} />
          ) : undefined,
          iconClassName: demorada
            ? 'bg-advertencia-suave text-advertencia'
            : 'bg-sup-compras text-mod-compras',
          note:
            diasPendiente === null
              ? 'Ninguna pendiente'
              : `La más antigua, ${diasPendiente === 0 ? 'de hoy' : antiguedad(diasPendiente)}`,
        }
      : null,
  }
  const resto = ORDEN.filter((clave) => clave !== hero)
  return [hero, ...resto].flatMap((clave) => todas[clave] ?? [])
}

export function IndicadoresDireccion({
  datos,
  acceso,
  cargando,
  error,
  contexto = {},
  ahora = new Date(),
}: {
  datos: IndicadoresDireccion
  acceso: AccesoIndicadores
  cargando: boolean
  error: boolean
  contexto?: ContextoVistaPrevia
  ahora?: Date
}) {
  const hero = ORDEN.find((clave) =>
    clave === 'deuda'
      ? acceso.facturacion
      : clave === 'alumnos'
        ? acceso.alumnos
        : clave === 'inasistencias'
          ? acceso.academico
          : acceso.compras,
  )
  if (!hero) return null
  const tarjetas = construirTarjetas(datos, acceso, hero, ahora, contexto)
  const columnas = COLUMNAS_XL[Math.min(tarjetas.length, 4) as 1 | 2 | 3 | 4]

  return (
    <section
      aria-label="Indicadores de Dirección"
      className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${columnas}`}
    >
      {tarjetas.map((tarjeta, indice) => {
        const esHero = indice === 0
        const enlace = (
          <Link
            to={tarjeta.to}
            aria-label={tarjeta.aria}
            className="group block h-full rounded-card-sm"
          >
            <StatTile
              label={tarjeta.label}
              value={error ? 'No disponible' : tarjeta.value}
              icon={tarjeta.icon}
              iconClassName={tarjeta.iconClassName}
              variant={esHero ? 'dark' : 'default'}
              hero={esHero}
              notaAlPie={!esHero}
              compact={!esHero}
              cargando={cargando}
              note={error || cargando ? undefined : tarjeta.note}
              className={`h-full transition-colors duration-200 ${esHero ? 'group-hover:bg-nav-hover' : 'group-hover:bg-fila-hover'}`}
            >
              {esHero && !cargando && !error ? tarjeta.desglose : null}
            </StatTile>
          </Link>
        )
        const celda = esHero ? 'sm:col-span-2' : ''
        if (!tarjeta.vistaPrevia || error || cargando)
          return (
            <div key={tarjeta.clave} className={celda}>
              {enlace}
            </div>
          )
        return (
          <HoverCard key={tarjeta.clave} openDelay={250} closeDelay={80}>
            <HoverCardTrigger asChild>
              <div className={celda}>{enlace}</div>
            </HoverCardTrigger>
            <HoverCardContent align="start">{tarjeta.vistaPrevia}</HoverCardContent>
          </HoverCard>
        )
      })}
    </section>
  )
}
