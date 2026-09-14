import {
  ClipboardCheckIcon,
  ClipboardListIcon,
  LandmarkIcon,
  TruckIcon,
  UsersRoundIcon,
} from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  PERMISO_FACTURACION_LEER,
  PERMISO_FAMILIAS_ALUMNOS_LEER,
  PERMISO_INSCRIPCIONES_LEER,
  PERMISO_PROVEEDORES_COMPRAS_LEER,
  tienePermiso,
} from '@/modules/auth/constants'
import { permisosActivos, useAuthStore } from '@/store/auth-store'

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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader titulo="Panel Administrativo" />

      <section aria-label="Accesos rápidos" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {accesosVisibles.map(({ titulo, descripcion, href, icono: Icono }) => (
          <Link key={href} to={href} className="group rounded-card">
            <Card className="h-full py-4 transition-colors duration-200 group-hover:bg-fila-hover">
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
