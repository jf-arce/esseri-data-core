import { Outlet } from 'react-router'
import { MenuCuenta } from '@/layout/menu-cuenta'

// Shell Portal (§8 DESIGN.md): sin rail lateral — para Docente y Familia, que tienen su propio
// flujo, sin nada que ver con el de Consola (Dirección/Administración). Sin buscador global ni
// selector de ciclo: esos accesos son de backoffice, no le corresponden a este shell.
//
// Sin nav de píldoras todavía: el Portal no tiene pantallas propias (lo construye otro
// integrante del equipo) — por ahora es solo el header mínimo alrededor de la página en blanco
// de cada vista (`portal-docente-page.tsx` / `portal-familia-page.tsx`).
export function PortalLayout() {
  return (
    <div className="min-h-svh bg-lienzo">
      <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-borde bg-superficie px-7">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-nav">
            <img src="/esseri-icon.png" alt="" className="size-5 object-contain" />
          </div>
          <span className="text-sm font-semibold text-texto">ESSERI</span>
        </div>

        <div className="ml-auto">
          <MenuCuenta />
        </div>
      </header>

      <main className="px-8 py-6">
        <Outlet />
      </main>
    </div>
  )
}
