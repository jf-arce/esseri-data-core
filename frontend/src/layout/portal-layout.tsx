import { useState } from 'react'
import { BellIcon, MenuIcon } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import {
  PORTAL_FAMILIA_BACKGROUND,
  PORTAL_FAMILIA_HEADER_BACKGROUND,
} from '@/components/portal-familia/portal-familia-shell'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { CampanitaNotificaciones } from '@/modules/notificaciones/components/campanita-notificaciones'
import { MenuCuenta } from '@/layout/menu-cuenta'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth-store'

const ENLACES = [
  { to: '/familia', etiqueta: 'Inicio', end: true },
  { to: '/familia/asistencias', etiqueta: 'Asistencias', end: false },
  { to: '/familia/facturacion', etiqueta: 'Facturación', end: false },
  { to: '/familia/comunicaciones', etiqueta: 'Comunicaciones', end: false },
  { to: '/familia/calendario', etiqueta: 'Calendario', end: false },
] as const

// Shell del Portal Familia (§8 DESIGN.md): única cabecera del portal, con el tratamiento
// oscuro del mundo visual familiar. Las páginas no repiten marca ni navegación.
export function PortalLayout() {
  const rolActivo = useAuthStore((state) => state.rolActivo)
  const usuario = useAuthStore((state) => state.usuario)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'rounded-full px-2.5 py-2 text-sm font-semibold whitespace-nowrap transition-colors lg:px-4 lg:text-sm',
      isActive
        ? 'bg-nav-activo text-lila-claro'
        : 'text-white/70 hover:bg-white/10 hover:text-white',
    )

  return (
    <div
      className="portal-familia relative min-h-svh"
      style={{ background: PORTAL_FAMILIA_BACKGROUND }}
    >
      <div
        data-slot="portal-familia-background"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: PORTAL_FAMILIA_BACKGROUND }}
      />
      <header
        className="sticky top-0 z-30 border-b border-white/10 print:hidden"
        style={{ background: PORTAL_FAMILIA_HEADER_BACKGROUND }}
      >
        <div className="relative mx-auto flex min-h-16 w-full max-w-[92vw] items-center gap-3 py-3">
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
              className="ml-4 hidden min-w-0 items-center gap-1 lg:absolute lg:top-1/2 lg:left-1/2 lg:ml-0 lg:flex lg:-translate-x-1/2 lg:-translate-y-1/2"
            >
              {ENLACES.map(({ to, etiqueta, end }) => (
                <NavLink key={to} to={to} end={end} className={navItemClass}>
                  {etiqueta}
                </NavLink>
              ))}
            </nav>
          )}

          <div className="ml-auto">
            <div className="flex items-center gap-1.5">
              {rolActivo === 'familia' && usuario ? (
                <CampanitaNotificaciones
                  key={`${usuario.id}:${rolActivo}`}
                  usuarioId={usuario.id}
                  rolActivo={rolActivo}
                />
              ) : (
                <button
                  type="button"
                  className="flex size-9 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="No hay notificaciones nuevas"
                  disabled
                >
                  <BellIcon aria-hidden="true" className="size-4" />
                </button>
              )}
              <MenuCuenta className="hover:bg-white/10" />

              {rolActivo === 'familia' && (
                <Sheet open={menuAbierto} onOpenChange={setMenuAbierto}>
                  <SheetTrigger asChild>
                    <button
                      type="button"
                      aria-label="Abrir menú de navegación"
                      className="flex size-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
                    >
                      <MenuIcon aria-hidden="true" className="size-5" />
                    </button>
                  </SheetTrigger>
                  <SheetContent side="left" className="portal-familia w-[85vw] max-w-xs">
                    <SheetHeader>
                      <SheetTitle className="font-heading text-pf-encabezado">Menú</SheetTitle>
                      <SheetDescription>Portal de Familia</SheetDescription>
                    </SheetHeader>
                    <nav
                      aria-label="Navegación del portal de familia"
                      className="flex flex-col gap-1 px-4 pb-6"
                    >
                      {ENLACES.map(({ to, etiqueta, end }) => (
                        <NavLink
                          key={to}
                          to={to}
                          end={end}
                          onClick={() => setMenuAbierto(false)}
                          className={({ isActive }) =>
                            cn(
                              'flex min-h-11 items-center rounded-full px-4 text-pf-cuerpo font-semibold transition-colors',
                              isActive
                                ? 'bg-pf-lila text-pf-accent'
                                : 'text-texto hover:bg-pf-item-hover',
                            )
                          }
                        >
                          {etiqueta}
                        </NavLink>
                      ))}
                    </nav>
                  </SheetContent>
                </Sheet>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="@container/main relative z-10 px-4 py-6 sm:px-8">
        <Outlet />
      </main>
    </div>
  )
}
