import {
  CircleDollarSignIcon,
  ClipboardListIcon,
  UserRoundCheckIcon,
  UserRoundXIcon,
} from 'lucide-react'
import { Link } from 'react-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { PageHeader } from '@/components/page-header'
import { StatTile } from '@/components/stat-tile'
import { useIndicadoresDireccion } from '@/modules/panel-admin/hooks/use-indicadores-direccion'
import { formatearMoneda } from '@/modules/facturacion/utils'

export function PanelDireccionPage() {
  const { datos, cargando, error } = useIndicadoresDireccion()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader titulo="Panel de Dirección" />

      {error && (
        <Alert variant="error">
          <AlertTitle>No se pudo actualizar el panel</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section
        aria-label="Indicadores de Dirección"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Link
          to="/familias-alumnos/alumnos"
          aria-label="Ver alumnos activos"
          className="group rounded-card-sm focus-visible:ring-2 focus-visible:ring-violeta focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <StatTile
            label="Alumnos activos"
            value={datos.alumnos_activos}
            icon={UserRoundCheckIcon}
            variant="dark"
            compact
            cargando={cargando}
            className="h-full transition-colors duration-200 group-hover:bg-nav-hover"
          />
        </Link>
        <Link
          to="/facturacion"
          aria-label="Ver facturas y deuda pendiente"
          className="group rounded-card-sm focus-visible:ring-2 focus-visible:ring-violeta focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <StatTile
            label="Deuda pendiente"
            value={formatearMoneda(datos.deuda_pendiente_total)}
            icon={CircleDollarSignIcon}
            iconClassName="bg-sup-facturacion text-mod-facturacion"
            compact
            cargando={cargando}
            className="h-full transition-colors duration-200 group-hover:bg-fila-hover"
          />
        </Link>
        <Link
          to="/academico"
          aria-label="Ver inasistencias en Académico"
          className="group rounded-card-sm focus-visible:ring-2 focus-visible:ring-violeta focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <StatTile
            label="Inasistencias de hoy"
            value={datos.inasistencias_hoy}
            icon={UserRoundXIcon}
            iconClassName="bg-sup-academico text-mod-academico"
            compact
            cargando={cargando}
            className="h-full transition-colors duration-200 group-hover:bg-fila-hover"
          />
        </Link>
        <Link
          to="/solicitudes-compra"
          aria-label="Ver solicitudes de compra pendientes"
          className="group rounded-card-sm focus-visible:ring-2 focus-visible:ring-violeta focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <StatTile
            label="Solicitudes de compra pendientes"
            value={datos.solicitudes_compra_pendientes}
            icon={ClipboardListIcon}
            iconClassName="bg-sup-compras text-mod-compras"
            compact
            cargando={cargando}
            className="h-full transition-colors duration-200 group-hover:bg-fila-hover"
          />
        </Link>
      </section>
    </div>
  )
}
