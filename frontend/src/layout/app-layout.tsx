import { BellIcon, ChevronDownIcon, LogOut, Menu, Search, ShieldCheckIcon, UserIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
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

// Paleta de comandos (vista `Shell` del mock): fachada sobre las búsquedas por módulo, sin
// alcance propio todavía. El único ítem que navega de verdad hoy es "Usuarios y roles"; el
// resto queda deshabilitado a propósito, con el motivo a la vista en CommandEmpty.
function ComandoGlobal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Buscar o ir a…">
      <Command>
        <CommandInput placeholder="Buscar o ir a…" />
        <CommandList>
          <CommandEmpty>La búsqueda global todavía no está conectada.</CommandEmpty>
          <CommandGroup heading="Ir a">
            <CommandItem
              onSelect={() => {
                onOpenChange(false)
                navigate('/configuracion/acceso')
              }}
            >
              <ShieldCheckIcon />
              Usuarios y roles
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Familias">
            <CommandItem disabled>Buscar familias (todavía no conectado)</CommandItem>
          </CommandGroup>
          <CommandGroup heading="Facturación">
            <CommandItem disabled>Buscar facturas (todavía no conectado)</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}

export function AppLayout() {
  const sidebarOpen = useUiStore((state) => state.sidebarOpen)
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen)
  const usuario = useAuthStore((state) => state.usuario)
  const clearSesion = useAuthStore((state) => state.clearSesion)
  const location = useLocation()
  const navigate = useNavigate()
  const [comandoAbierto, setComandoAbierto] = useState(false)
  const [ciclo, setCiclo] = useState('2026')

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
  const tieneMasDeUnRol = (usuario?.roles.length ?? 0) > 1

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
          <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-4 border-b border-borde bg-superficie px-7">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-texto-2 hover:bg-fila-hover"
              aria-label="Mostrar u ocultar la navegación"
            >
              <Menu className="size-5" />
            </button>

            <button
              type="button"
              onClick={() => setComandoAbierto(true)}
              className="mx-auto flex h-10 w-full max-w-[600px] items-center gap-2.5 rounded-full border border-borde bg-lienzo px-4 text-left text-sm text-texto-3 hover:bg-fila-hover"
            >
              <Search className="size-4 shrink-0" />
              <span>Buscar o ir a…</span>
              <kbd className="ml-auto rounded-md border border-borde bg-superficie px-1.5 py-0.5 text-xs text-texto-3">
                ⌘K
              </kbd>
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-borde px-3 py-2 text-sm font-medium text-texto-2 hover:bg-fila-hover"
                >
                  Ciclo {ciclo}
                  <ChevronDownIcon className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup value={ciclo} onValueChange={setCiclo}>
                  <DropdownMenuRadioItem value="2026">2026</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="2025">2025</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="relative flex size-9 shrink-0 items-center justify-center rounded-full text-texto-2 hover:bg-fila-hover"
                  aria-label="Notificaciones"
                >
                  <BellIcon className="size-5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80">
                <Empty className="p-4">
                  <EmptyMedia variant="neutral">
                    <BellIcon />
                  </EmptyMedia>
                  <EmptyTitle>No hay notificaciones</EmptyTitle>
                  <EmptyDescription>
                    Todavía no hay avisos para mostrar acá.
                  </EmptyDescription>
                </Empty>
              </PopoverContent>
            </Popover>

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
                <DropdownMenuLabel className="flex flex-col gap-1">
                  <span className="font-medium text-texto">{usuario?.email}</span>
                  <div className="flex flex-wrap gap-1">
                    {usuario?.roles.length ? (
                      usuario.roles.map((rol) => (
                        <Badge key={rol} variant="secondary">
                          {rol}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs font-normal text-texto-3">Sin rol asignado</span>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={!tieneMasDeUnRol}>
                  <ShieldCheckIcon />
                  Cambiar vista
                </DropdownMenuItem>
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

          <main className="min-w-0 flex-1 px-10 py-8">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>

      <ComandoGlobal open={comandoAbierto} onOpenChange={setComandoAbierto} />
    </TooltipProvider>
  )
}
