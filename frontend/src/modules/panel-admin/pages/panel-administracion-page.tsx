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

const accesos = [
  {
    titulo: 'Familias',
    descripcion: 'Responsables, familias y alumnos.',
    href: '/familias-alumnos',
    icono: UsersRoundIcon,
  },
  {
    titulo: 'Facturación',
    descripcion: 'Facturas, pagos y reglas de facturación.',
    href: '/facturacion',
    icono: LandmarkIcon,
  },
  {
    titulo: 'Proveedores',
    descripcion: 'Catálogo y datos de proveedores.',
    href: '/proveedores',
    icono: TruckIcon,
  },
  {
    titulo: 'Inscripciones',
    descripcion: 'Altas, reinscripciones y movimientos.',
    href: '/inscripciones',
    icono: ClipboardCheckIcon,
  },
  {
    titulo: 'Compras',
    descripcion: 'Solicitudes y seguimiento de compras.',
    href: '/solicitudes-compra',
    icono: ClipboardListIcon,
  },
]

export function PanelAdministracionPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader titulo="Panel Administrativo" />

      <section aria-label="Accesos rápidos" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {accesos.map(({ titulo, descripcion, href, icono: Icono }) => (
          <Link
            key={href}
            to={href}
            className="group rounded-card focus-visible:ring-2 focus-visible:ring-violeta focus-visible:ring-offset-2 focus-visible:outline-none"
          >
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
