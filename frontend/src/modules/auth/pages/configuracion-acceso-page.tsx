import { Link, Outlet, useLocation } from 'react-router'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const TABS = [
  { value: 'usuarios', label: 'Usuarios', href: '/configuracion/acceso/usuarios' },
  { value: 'roles', label: 'Roles', href: '/configuracion/acceso/roles' },
  { value: 'permisos', label: 'Permisos', href: '/configuracion/acceso/permisos' },
  { value: 'matriz', label: 'Matriz', href: '/configuracion/acceso/matriz' },
] as const

function tabActivo(pathname: string): (typeof TABS)[number]['value'] {
  const encontrado = TABS.find((tab) => pathname.startsWith(tab.href))
  return encontrado?.value ?? 'usuarios'
}

// Layout de la sección: eyebrow + tabs (cada uno una ruta real, ver `routes.tsx`) + Outlet.
// El título y la acción primaria de cada tab viven en la página del tab (`PageHeader`),
// porque son ellas las que tienen el estado del diálogo que esa acción abre.
export function ConfiguracionAccesoPage() {
  const location = useLocation()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold tracking-[.08em] text-texto-3 uppercase">Configuración</p>

        <Tabs value={tabActivo(location.pathname)}>
          <TabsList>
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} asChild>
                <Link to={tab.href}>{tab.label}</Link>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <Outlet />
    </div>
  )
}
