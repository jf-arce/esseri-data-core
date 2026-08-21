import { Outlet } from 'react-router'
import { Button } from '@/components/ui/button'
import { useUiStore } from '@/store/ui-store'
import { cn } from '@/lib/utils'

export function AppLayout() {
  const sidebarOpen = useUiStore((state) => state.sidebarOpen)
  const toggleSidebar = useUiStore((state) => state.toggleSidebar)

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center gap-2 border-b p-4">
        <Button variant="ghost" size="icon" onClick={toggleSidebar}>
          ☰
        </Button>
        <span className="font-semibold">ESSERI Data Core</span>
      </header>
      <div className="flex flex-1">
        <aside
          className={cn(
            'w-56 shrink-0 border-r p-4 transition-all',
            !sidebarOpen && 'w-0 overflow-hidden p-0',
          )}
        >
          {/* Navegación por módulo: se completa a medida que cada módulo tenga páginas reales */}
        </aside>
        <main className="flex-1 p-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
