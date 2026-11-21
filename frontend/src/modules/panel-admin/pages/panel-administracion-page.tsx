import { ClipboardListIcon, FileWarningIcon, LandmarkIcon } from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { StatTile } from '@/components/stat-tile'
import { formatearMoneda } from '@/modules/facturacion/utils'
import {
  PERMISO_ACADEMICO_ACTUALIZAR_JUSTIFICACIONES,
  PERMISO_FACTURACION_LEER,
  PERMISO_FAMILIAS_ALUMNOS_LEER,
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

export function PanelAdministracionPage() {
  const permisos = useAuthStore(permisosActivos)
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
    <div className="flex flex-col gap-4">
      <PageHeader titulo="Panel Administrativo" />

      <AtencionInstitucional acceso={atencion} version={0} />

      {indicadores.length > 0 && (
        <section
          aria-label="Indicadores operativos"
          className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @3xl/main:grid-cols-3"
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
                compact
                cargando={cargando}
                className="h-full transition-colors duration-200 group-hover:bg-fila-hover"
              />
            </Link>
          ))}
        </section>
      )}

      {(atencion.justificaciones || acceso.finanzas) && (
        <Link
          className="text-sm font-semibold text-violeta hover:underline"
          to="/comunicaciones/conversaciones"
        >
          Ver conversaciones pendientes
        </Link>
      )}

      {/* La cola de atención (8) y la actividad reciente (4), que toma su altura y hace scroll. */}
      <div className="grid min-w-0 items-stretch gap-4 @5xl/main:grid-cols-12">
        {hayAtencion && (
          <div
            className={cn(
              'min-w-0',
              hayActividad ? '@5xl/main:col-span-8' : '@5xl/main:col-span-12',
            )}
          >
            <AtencionDireccion
              compras={detalle.compras}
              deudas={detalle.deudas}
              acceso={{ compras: acceso.compras, finanzas: acceso.finanzas }}
            />
          </div>
        )}
        {hayActividad && (
          <div
            className={cn(
              'min-w-0',
              hayAtencion
                ? '@5xl/main:col-span-4 @5xl/main:h-0 @5xl/main:min-h-full'
                : '@5xl/main:col-span-12',
            )}
          >
            <PanelActividadReciente
              recurso={detalle.actividad}
              contenidoClassName={cn(
                'min-h-0 flex-1 overflow-y-auto',
                hayAtencion ? 'max-h-96 @5xl/main:max-h-none' : 'max-h-96',
              )}
            />
          </div>
        )}
      </div>
    </div>
  )
}
