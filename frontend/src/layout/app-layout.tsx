import {
  BellIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  LogOut,
  Menu,
  Search,
  UserIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
import { GlobalSearchDialog } from '@/layout/global-search-dialog'
import { logout } from '@/modules/auth/services/logout'
import { colorIdentidad, formatearNombreRol, nombreDeUsuario } from '@/modules/auth/utils'
import { useAuthStore } from '@/store/auth-store'
import { useUiStore } from '@/store/ui-store'
import { Button } from '@/components/ui/button'

export function AppLayout() {
  const sidebarOpen = useUiStore((state) => state.sidebarOpen)
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen)
  const usuario = useAuthStore((state) => state.usuario)
  const clearSesion = useAuthStore((state) => state.clearSesion)
  const location = useLocation()
  const navigate = useNavigate()
  const [comandoAbierto, setComandoAbierto] = useState(false)
  const [ciclo, setCiclo] = useState('2026')
  const [cambiarVistaAbierto, setCambiarVistaAbierto] = useState(false)

  // Sin notificaciones conectadas todavía (backend no expone el endpoint): el punto de "no
  // leídas" queda listo, oculto hasta que haya datos reales que mostrar.
  const hayNotificacionesSinLeer = false

  useEffect(() => {
    function onKeyDown(evento: KeyboardEvent) {
      if (evento.key === 'k' && (evento.metaKey || evento.ctrlKey)) {
        evento.preventDefault()
        setComandoAbierto((abierto) => !abierto)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  async function cerrarSesion() {
    await logout().catch(() => {})
    clearSesion()
    navigate('/login', { replace: true })
  }

  const inicialAvatar = usuario?.email.charAt(0).toUpperCase() ?? '?'
  const rolActual = usuario?.roles[0] ?? null
  const otrosRoles = usuario?.roles.slice(1) ?? []
  const tieneMasDeUnRol = otrosRoles.length > 0

  return (
    <TooltipProvider>
      <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <div className="flex items-center gap-2.5 px-1.5 py-1">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-superficie">
                <img src="/esseri-icon.png" alt="" className="size-5 object-contain" />
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
          <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-4 border-b border-borde bg-superficie px-7">
            <Button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              variant="ghost"
              className="flex cursor-pointer size-9 shrink-0 items-center justify-center rounded-full"
              aria-label="Mostrar u ocultar la navegación"
            >
              <Menu className="size-4.5" />
            </Button>

            <button
              type="button"
              onClick={() => setComandoAbierto(true)}
              className="mx-auto flex h-10 w-full max-w-150 cursor-pointer items-center gap-2.5 rounded-full border border-borde bg-lienzo px-4 text-left text-sm text-texto-3 hover:bg-fila-hover"
            >
              <Search className="size-4 shrink-0" />
              <span>Buscar o ir a…</span>
              <kbd className="ml-auto rounded-md border border-borde bg-superficie px-1.5 py-0.5">
                <div className="text-xs text-texto-3 flex gap-0.5 items-center justify-center">
                  <span>⌘</span>
                  <span>K</span>
                </div>
              </kbd>
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-borde px-3 py-2 text-sm font-medium text-texto-2 hover:bg-fila-hover"
                >
                  <CalendarIcon className="size-4 text-texto-3" />
                  Ciclo {ciclo}
                  <ChevronDownIcon className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup value={ciclo} onValueChange={setCiclo}>
                  <DropdownMenuRadioItem value="2026">
                    <CalendarIcon className="text-texto-3" />
                    2026
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="2025">
                    <CalendarIcon className="text-texto-3" />
                    2025
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-texto-2 hover:bg-fila-hover"
                  aria-label="Notificaciones"
                >
                  <BellIcon className="size-5" />
                  {hayNotificacionesSinLeer && (
                    <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-advertencia" />
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80">
                <Empty className="p-4">
                  <EmptyMedia variant="neutral">
                    <BellIcon />
                  </EmptyMedia>
                  <EmptyTitle>No hay notificaciones</EmptyTitle>
                  <EmptyDescription>Todavía no hay avisos para mostrar acá.</EmptyDescription>
                </Empty>
              </PopoverContent>
            </Popover>

            <DropdownMenu
              onOpenChange={(open) => {
                if (!open) setCambiarVistaAbierto(false)
              }}
            >
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="cursor-pointer rounded-full p-0.5 hover:bg-fila-hover focus-visible:ring-2 focus-visible:ring-violeta focus-visible:ring-offset-2 focus-visible:outline-none"
                  aria-label="Cuenta"
                >
                  <Avatar>
                    <AvatarFallback className="bg-violeta text-xs font-semibold text-superficie">
                      {inicialAvatar}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="flex flex-col gap-1 px-2.5 pt-2.5 pb-2 text-sm font-normal normal-case tracking-normal text-texto">
                  <span className="text-sm font-semibold text-texto">
                    {usuario ? nombreDeUsuario(usuario.email) : ''}
                  </span>
                  <span className="text-xs text-texto-3">{usuario?.email}</span>
                  {rolActual && (
                    <span
                      className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full py-1 pr-3 pl-2.5 text-[11px] font-semibold"
                      style={{
                        backgroundColor: `color-mix(in oklch, ${colorIdentidad(rolActual)} 12%, white)`,
                        color: colorIdentidad(rolActual),
                      }}
                    >
                      <span
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: colorIdentidad(rolActual) }}
                      />
                      {formatearNombreRol(rolActual)}
                    </span>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {tieneMasDeUnRol && (
                  <>
                    <DropdownMenuItem
                      className="justify-between text-texto-2"
                      onSelect={(evento) => {
                        evento.preventDefault()
                        setCambiarVistaAbierto((abierto) => !abierto)
                      }}
                    >
                      Cambiar vista
                      <ChevronDownIcon
                        className={`size-4! transition-transform duration-150 ${cambiarVistaAbierto ? 'rotate-180' : ''}`}
                      />
                    </DropdownMenuItem>
                    {cambiarVistaAbierto && (
                      <div className="flex flex-col gap-0.5 py-1">
                        {rolActual && (
                          <div className="flex items-center gap-2.5 rounded-md py-1.5 pr-4 pl-8 text-sm font-semibold text-texto">
                            <span
                              className="flex size-6 shrink-0 items-center justify-center rounded-lg"
                              style={{
                                backgroundColor: `color-mix(in oklch, ${colorIdentidad(rolActual)} 12%, white)`,
                                color: colorIdentidad(rolActual),
                              }}
                            >
                              <UserIcon className="size-3.5" />
                            </span>
                            {formatearNombreRol(rolActual)}
                            <CheckIcon className="ml-auto size-3.5 text-violeta" />
                          </div>
                        )}
                        {otrosRoles.map((rol) => (
                          <button
                            key={rol}
                            type="button"
                            className="flex cursor-pointer items-center gap-2.5 rounded-md py-1.5 pr-4 pl-8 text-sm text-texto-2 hover:bg-fila-hover"
                          >
                            <span
                              className="flex size-6 shrink-0 items-center justify-center rounded-lg"
                              style={{
                                backgroundColor: `color-mix(in oklch, ${colorIdentidad(rol)} 12%, white)`,
                                color: colorIdentidad(rol),
                              }}
                            >
                              <UserIcon className="size-3.5" />
                            </span>
                            {formatearNombreRol(rol)}
                          </button>
                        ))}
                      </div>
                    )}
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem disabled>
                  <UserIcon />
                  Mi cuenta
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={cerrarSesion}>
                  <LogOut />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main className="min-w-0 flex-1 px-8 py-6">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>

      <GlobalSearchDialog open={comandoAbierto} onOpenChange={setComandoAbierto} />
    </TooltipProvider>
  )
}
