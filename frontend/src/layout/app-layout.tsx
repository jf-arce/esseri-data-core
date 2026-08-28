import { ChevronDown, LogOut, Menu, Search } from 'lucide-react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { NAV_GROUPS } from '@/layout/nav-items'
import { logout } from '@/modules/auth/services/logout'
import { useAuthStore } from '@/store/auth-store'
import { useUiStore } from '@/store/ui-store'

// El isotipo de marca (§13 DESIGN.md): hexágono con nodos, versión mínima para el tile de 28px
// del rail. La ilustración geométrica completa es decorativa y va en portadas/estados vacíos,
// no acá.
function MarcaEsseri() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
      <path
        d="M12 3.5 20 8v8l-8 4.5L4 16V8z"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function AppLayout() {
  const sidebarOpen = useUiStore((state) => state.sidebarOpen)
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen)
  const usuario = useAuthStore((state) => state.usuario)
  const clearSesion = useAuthStore((state) => state.clearSesion)
  const location = useLocation()
  const navigate = useNavigate()

  async function cerrarSesion() {
    await logout().catch(() => {})
    clearSesion()
    navigate('/login', { replace: true })
  }

  const inicialAvatar = usuario?.email.charAt(0).toUpperCase() ?? '?'

  return (
    <TooltipProvider>
      <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <div className="flex items-center gap-2.5 px-1.5 py-1">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-violeta">
                <MarcaEsseri />
              </div>
              <span className="text-sm font-semibold text-texto-sobre-oscuro group-data-[collapsible=icon]:hidden">
                ESSERI
              </span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            {NAV_GROUPS.map((grupo) => (
              <SidebarGroup key={grupo.label}>
                <SidebarGroupLabel>{grupo.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {grupo.items.map((item) => (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={location.pathname.startsWith(item.href)}
                          tooltip={item.label}
                        >
                          <Link to={item.href}>
                            <item.icon />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>
        </Sidebar>

        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-4 border-b border-borde bg-superficie px-7">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-texto-2 hover:bg-fila-hover"
              aria-label="Mostrar u ocultar la navegación"
            >
              <Menu className="size-[18px]" />
            </button>

            <div className="mx-auto flex h-10 w-full max-w-[600px] items-center gap-2.5 rounded-full border border-borde bg-lienzo px-4 text-sm text-texto-3">
              <Search className="size-4 shrink-0" />
              <span>Buscar o ir a…</span>
              <kbd className="ml-auto rounded-md border border-borde bg-superficie px-1.5 py-0.5 text-xs text-texto-3">
                ⌘K
              </kbd>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-borde px-3 py-2 text-sm font-medium text-texto-2">
              Ciclo 2026
              <ChevronDown className="size-3.5" />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Cuenta">
                  <Avatar>
                    <AvatarFallback className="bg-violeta text-xs font-semibold text-superficie">
                      {inicialAvatar}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  <span className="font-medium text-texto">{usuario?.email}</span>
                  <span className="text-xs font-normal text-texto-3">
                    {usuario?.roles.join(', ') || 'Sin rol asignado'}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={cerrarSesion}>
                  <LogOut />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main className="flex-1 px-10 py-8">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
