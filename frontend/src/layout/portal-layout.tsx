import { BellIcon } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { MenuCuenta } from '@/layout/menu-cuenta'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'

// Shell del Portal Familia (§8 DESIGN.md): navegación compacta, separada de la consola de gestión.
export function PortalLayout() {
  const rolActivo = useAuthStore((state) => state.rolActivo)
  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
      isActive
        ? 'bg-violeta-suave text-violeta'
        : 'text-texto-2 hover:bg-fila-hover hover:text-texto',
    )

  return (
    <div className="min-h-svh bg-lienzo">
      <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center gap-3 border-b border-borde bg-superficie px-4 py-3 sm:flex-nowrap sm:px-7 sm:py-0">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-nav">
            <img src="/esseri-icon.png" alt="" className="size-5 object-contain" />
          </div>
          <span className="text-sm font-semibold text-texto">ESSERI</span>
        </div>

        {rolActivo === 'familia' && (
          <nav
            aria-label="Navegación del portal de familia"
            className="order-last mx-auto flex w-full min-w-0 items-center gap-2 overflow-x-auto sm:order-none sm:w-auto"
          >
            <NavLink to="/familia" end className={navItemClass}>
              Inicio
            </NavLink>
            <NavLink to="/familia/asistencias" className={navItemClass}>
              Asistencias
            </NavLink>
            <NavLink to="/familia/facturacion" className={navItemClass}>
              Facturación
            </NavLink>
            <NavLink to="/familia/comunicaciones" className={navItemClass}>
              Comunicaciones
            </NavLink>
          </nav>
        )}

        <div className="ml-auto">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex size-9 items-center justify-center rounded-full text-texto-2 transition-colors hover:bg-fila-hover hover:text-texto"
              aria-label="No hay notificaciones nuevas"
              disabled
            >
              <BellIcon aria-hidden="true" className="size-4" />
            </button>
            <MenuCuenta />
          </div>
        </div>
      </header>

      <main className="px-4 py-6 sm:px-8">
        <Outlet />
      </main>
    </div>
  )
}
