import {
  ClipboardCheckIcon,
  ClipboardListIcon,
  FileWarningIcon,
  LandmarkIcon,
  TruckIcon,
  UsersRoundIcon,
} from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { StatTile } from '@/components/stat-tile'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatearMoneda } from '@/modules/facturacion/utils'
import {
  PERMISO_ACADEMICO_ACTUALIZAR_JUSTIFICACIONES,
  PERMISO_FACTURACION_LEER,
  PERMISO_FAMILIAS_ALUMNOS_LEER,
  PERMISO_INSCRIPCIONES_LEER,
  PERMISO_PROVEEDORES_COMPRAS_LEER,
  tienePermiso,
} from '@/modules/auth/constants'
import { cn } from '@/lib/utils'
import { permisosActivos, useAuthStore } from '@/store/auth-store'
import { AtencionInstitucional } from '../components/atencion-institucional'
import { PanelActividadReciente } from '../components/actividad-reciente'
import { AtencionDireccion } from '../components/atencion-direccion'
import { useDetalleDireccion } from '../hooks/use-detalle-direccion'
import { useIndicadoresAdministracion } from '../hooks/use-indicadores-administracion'

const accesos = [
  {
    titulo: 'Familias',
    descripcion: 'Responsables, familias y alumnos.',
    href: '/familias-alumnos',
    icono: UsersRoundIcon,
    permiso: PERMISO_FAMILIAS_ALUMNOS_LEER,
  },
  {
    titulo: 'Facturación',
    descripcion: 'Facturas, pagos y reglas de facturación.',
    href: '/facturacion',
    icono: LandmarkIcon,
    permiso: PERMISO_FACTURACION_LEER,
  },
  {
    titulo: 'Proveedores',
    descripcion: 'Catálogo y datos de proveedores.',
    href: '/proveedores',
    icono: TruckIcon,
    permiso: PERMISO_PROVEEDORES_COMPRAS_LEER,
  },
  {
    titulo: 'Inscripciones',
    descripcion: 'Altas, reinscripciones y movimientos.',
    href: '/inscripciones',
    icono: ClipboardCheckIcon,
    permiso: PERMISO_INSCRIPCIONES_LEER,
  },
  {
    titulo: 'Compras',
    descripcion: 'Solicitudes y seguimiento de compras.',
    href: '/solicitudes-compra',
    icono: ClipboardListIcon,
    permiso: PERMISO_PROVEEDORES_COMPRAS_LEER,
  },
]

export function PanelAdministracionPage() {
  const permisos = useAuthStore(permisosActivos)
  const accesosVisibles = accesos.filter((acceso) => tienePermiso(permisos, acceso.permiso))
  const { datos, cargando, error } = useIndicadoresAdministracion()
  const acceso = {
    compras: tienePermiso(permisos, PERMISO_PROVEEDORES_COMPRAS_LEER),
    finanzas: tienePermiso(permisos, PERMISO_FACTURACION_LEER),
    alumnos: tienePermiso(permisos, PERMISO_FAMILIAS_ALUMNOS_LEER),
  }
  const atencion = {
    justificaciones: tienePermiso(permisos, PERMISO_ACADEMICO_ACTUALIZAR_JUSTIFICACIONES),
    // Administración no tiene permisos de Workflows: esa cola es de Dirección.
    workflows: false,
  }
  const hayAtencion = acceso.compras || acceso.finanzas
  const hayActividad = hayAtencion || acceso.alumnos
  const detalle = useDetalleDireccion({ ...acceso, academico: false }, 0)

  // Un bloque sin permiso llega en `null`: no se muestra. Mientras carga (`datos === null`)
  // se mantienen las tres tarjetas con esqueleto para no mover el layout.
  const indicadores = [
    {
      clave: 'vencidas',
      visible: datos === null || datos.facturas_vencidas !== null,
      label: 'Facturas vencidas',
      aria: 'Ver facturas vencidas',
      to: '/facturacion',
      icon: FileWarningIcon,
      iconClassName: 'bg-advertencia-suave text-advertencia',
      value: error ? 'No disponible' : (datos?.facturas_vencidas ?? 0),
      note: 'Con saldo impago y vencimiento pasado',
    },
    {
      clave: 'cobrado',
      visible: datos === null || datos.cobrado_mes !== null,
      label: 'Cobrado del mes',
      aria: 'Ver cobranzas del mes',
      to: '/facturacion',
      icon: LandmarkIcon,
      iconClassName: 'bg-exito-suave text-exito',
      value: error ? 'No disponible' : formatearMoneda(datos?.cobrado_mes ?? '0'),
      note: 'Pagos aprobados del mes en curso',
    },
    {
      clave: 'compras',
      visible: datos === null || datos.solicitudes_compra_pendientes !== null,
      label: 'Solicitudes pendientes',
      aria: 'Ver solicitudes de compra pendientes',
      to: '/solicitudes-compra?estado=pendiente',
      icon: ClipboardListIcon,
      iconClassName: 'bg-sup-compras text-mod-compras',
      value: error ? 'No disponible' : (datos?.solicitudes_compra_pendientes ?? 0),
      note: 'Sin decisión',
    },
  ].filter((indicador) => indicador.visible)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader titulo="Panel Administrativo" />

      {indicadores.length > 0 && (
        <section
          aria-label="Indicadores operativos"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {indicadores.map((indicador) => (
            <Link
              key={indicador.clave}
              to={indicador.to}
              aria-label={indicador.aria}
              className="group"
            >
              <StatTile
                label={indicador.label}
                value={indicador.value}
                icon={indicador.icon}
                iconClassName={indicador.iconClassName}
                note={indicador.note}
                cargando={cargando}
                className="h-full transition-colors duration-200 group-hover:bg-fila-hover"
              />
            </Link>
          ))}
        </section>
      )}

      {atencion.justificaciones && <AtencionInstitucional acceso={atencion} version={0} />}

      <div className="grid min-w-0 items-stretch gap-6 xl:grid-cols-12">
        {hayAtencion && (
          <div className={cn('min-w-0', hayActividad ? 'xl:col-span-6' : 'xl:col-span-12')}>
            <AtencionDireccion
              compras={detalle.compras}
              deudas={detalle.deudas}
              acceso={{ compras: acceso.compras, finanzas: acceso.finanzas }}
            />
          </div>
        )}
        {hayActividad && (
          <div className={cn('min-w-0', hayAtencion ? 'xl:col-span-6' : 'xl:col-span-12')}>
            <PanelActividadReciente
              recurso={detalle.actividad}
              contenidoClassName="max-h-96 min-h-0 flex-1 overflow-y-auto"
            />
          </div>
        )}
      </div>

      <section aria-label="Accesos rápidos" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {accesosVisibles.map(({ titulo, descripcion, href, icono: Icono }) => (
          <Link key={href} to={href} className="group rounded-card">
            <Card className="h-full py-4 transition-[background-color,box-shadow] duration-200 group-hover:bg-(--card-hover) group-hover:shadow-(--sombra-card-hover)">
              <CardHeader>
                <div className="mb-1 flex size-10 items-center justify-center rounded-[10px] bg-violeta-suave text-violeta">
                  <Icono className="size-5" />
                </div>
                <CardTitle>{titulo}</CardTitle>
                <CardDescription>{descripcion}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm font-medium text-violeta">Abrir {titulo}</CardContent>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  )
}
