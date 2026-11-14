import { BellIcon } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import {
  PORTAL_FAMILIA_BACKGROUND,
  PORTAL_FAMILIA_GLOW_CENTRAL,
  PORTAL_FAMILIA_GLOW_DERECHO,
} from '@/components/portal-familia/portal-familia-shell'
import { MenuCuenta } from '@/layout/menu-cuenta'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'

// Shell del Portal Familia (§8 DESIGN.md): única cabecera del portal, con el tratamiento
// oscuro del mundo visual familiar. Las páginas no repiten marca ni navegación.
export function PortalLayout() {
  const rolActivo = useAuthStore((state) => state.rolActivo)
  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors',
      isActive
        ? 'bg-white/15 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)]'
        : 'text-white/70 hover:bg-white/10 hover:text-white',
    )

  return (
    <div className="portal-familia relative min-h-svh bg-[#4A3A63]">
      <div
        data-slot="portal-familia-background"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: PORTAL_FAMILIA_BACKGROUND }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: PORTAL_FAMILIA_GLOW_DERECHO }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: PORTAL_FAMILIA_GLOW_CENTRAL }}
      />

      <header className="sticky top-0 z-30 flex min-h-16 flex-wrap items-center gap-3 border-b border-white/10 bg-[#2C2143]/35 px-4 py-3 backdrop-blur-md sm:flex-nowrap sm:px-7 sm:py-0">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
            <img
              src="/esseri-icon.png"
              alt=""
              className="size-5 object-contain brightness-0 invert"
            />
          </div>
          <span className="font-heading text-base font-semibold tracking-[0.02em] text-white">
            ESSERI
          </span>
        </div>

        {rolActivo === 'familia' && (
          <nav
            aria-label="Navegación del portal de familia"
            className="order-last mx-auto flex w-full min-w-0 items-center gap-1 overflow-x-auto sm:order-none sm:w-auto"
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
            <NavLink to="/familia/calendario" className={navItemClass}>
              Calendario
            </NavLink>
          </nav>
        )}

        <div className="ml-auto">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex size-9 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="No hay notificaciones nuevas"
              disabled
            >
              <BellIcon aria-hidden="true" className="size-4" />
            </button>
            <MenuCuenta className="hover:bg-white/10" />
          </div>
        </div>
      </header>

      <main className="relative z-10 px-4 py-6 sm:px-8">
        <Outlet />
      </main>
    </div>
  )
}
