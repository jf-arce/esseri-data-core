import {
  CheckIcon,
  ChevronDownIcon,
  LogOut,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  UserIcon,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { rutaInicioDe } from '@/layout/nav-items'
import { logout } from '@/modules/auth/services/logout'
import type { PerfilRol } from '@/modules/auth/types'
import {
  colorIdentidad,
  colorIdentidadSuave,
  formatearNombreRol,
  nombreDeUsuario,
} from '@/modules/auth/utils'
import { useAuthStore } from '@/store/auth-store'
import { useUiStore } from '@/store/ui-store'

// Menú del avatar (§8.1 DESIGN.md), compartido por los dos shells (Consola y Portal): cabecera
// con rol activo, "Cambiar vista" (solo si la cuenta tiene más de un rol), "Mi cuenta" y
// "Cerrar sesión" — el mismo mecanismo sin importar desde qué vista se abre.
export function MenuCuenta() {
  const usuario = useAuthStore((state) => state.usuario)
  const rolActivo = useAuthStore((state) => state.rolActivo)
  const setRolActivo = useAuthStore((state) => state.setRolActivo)
  const clearSesion = useAuthStore((state) => state.clearSesion)
  const themePreference = useUiStore((state) => state.themePreference)
  const setThemePreference = useUiStore((state) => state.setThemePreference)
  const navigate = useNavigate()
  const [cambiarVistaAbierto, setCambiarVistaAbierto] = useState(false)

  const inicialAvatar = usuario?.email.charAt(0).toUpperCase() ?? '?'
  const rolActual = rolActivo
  const nombreRolActivo = usuario?.perfiles.find((perfil) => perfil.codigo === rolActivo)?.nombre
  const otrosRoles: PerfilRol[] = (usuario?.perfiles ?? []).filter(
    (perfil) => perfil.codigo !== rolActivo,
  )
  const tieneMasDeUnRol = otrosRoles.length > 0

  async function cambiarVista(codigo: string) {
    // Permisos del rol elegido calculados acá (no vía `permisosActivos`, que todavía lee el
    // rol viejo hasta el próximo render): `rutaInicioDe` los necesita ya, para no navegar a
    // "/" y depender de un segundo redirect.
    const permisosDelRol =
      usuario?.perfiles.find((perfil) => perfil.codigo === codigo)?.permisos ?? []
    try {
      await setRolActivo(codigo)
      setCambiarVistaAbierto(false)
      navigate(rutaInicioDe(codigo, permisosDelRol) ?? '/', { replace: true })
    } catch {
      toast.error('No se pudo cambiar de rol. Intentá de nuevo.')
    }
  }

  async function cerrarSesion() {
    await logout().catch(() => {})
    clearSesion()
    navigate('/login', { replace: true })
  }

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open) setCambiarVistaAbierto(false)
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="cursor-pointer rounded-full p-0.5 hover:bg-fila-hover"
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
          {rolActual && nombreRolActivo && (
            <span
              className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full p-0.5 pr-3 pl-2.5 text-xs font-semibold"
              style={{
                backgroundColor: colorIdentidadSuave(rolActual),
                color: colorIdentidad(rolActual),
              }}
            >
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: colorIdentidad(rolActual) }}
              />
              {formatearNombreRol(nombreRolActivo)}
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
                {rolActual && nombreRolActivo && (
                  <div className="flex items-center gap-2.5 rounded-md py-1.5 pr-4 pl-8 text-sm font-semibold text-texto">
                    <span
                      className="flex size-6 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: colorIdentidadSuave(rolActual),
                        color: colorIdentidad(rolActual),
                      }}
                    >
                      <UserIcon className="size-3.5" />
                    </span>
                    {formatearNombreRol(nombreRolActivo)}
                    <CheckIcon className="ml-auto size-3.5 text-violeta" />
                  </div>
                )}
                {otrosRoles.map((perfil) => (
                  <button
                    key={perfil.codigo}
                    type="button"
                    onClick={() => cambiarVista(perfil.codigo)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md py-1.5 pr-4 pl-8 text-sm text-texto-2 hover:bg-fila-hover"
                  >
                    <span
                      className="flex size-6 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: colorIdentidadSuave(perfil.codigo),
                        color: colorIdentidad(perfil.codigo),
                      }}
                    >
                      <UserIcon className="size-3.5" />
                    </span>
                    {formatearNombreRol(perfil.nombre)}
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
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <MonitorIcon />
            Tema
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-44">
            <DropdownMenuRadioGroup
              value={themePreference}
              onValueChange={(preference) => {
                if (preference === 'light' || preference === 'dark') {
                  setThemePreference(preference)
                }
              }}
            >
              <DropdownMenuRadioItem value="light">
                <SunIcon />
                Claro
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <MoonIcon />
                Oscuro
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={cerrarSesion}>
          <LogOut />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
