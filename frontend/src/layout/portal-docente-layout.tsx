import {
  BellIcon,
  BookOpenCheckIcon,
  CalendarIcon,
  GraduationCapIcon,
  MailIcon,
  UserRoundIcon,
} from 'lucide-react'
import { Link, Outlet, useLocation } from 'react-router'
import { MenuCuenta } from '@/layout/menu-cuenta'
import { cn } from '@/lib/utils'

const navegacionDocente = [
  { id: 'inicio', href: '/docente', label: 'Inicio', icon: GraduationCapIcon },
  { id: 'cursos', href: '/docente/cursos', label: 'Mis cursos', icon: BookOpenCheckIcon },
  { id: 'asistencia', href: '/docente/asistencia', label: 'Asistencia', icon: CalendarIcon },
  { id: 'alumnos', href: '/docente/alumnos', label: 'Alumnos', icon: UserRoundIcon },
  {
    id: 'comunicaciones',
    href: '/docente/comunicaciones',
    label: 'Comunicaciones',
    icon: MailIcon,
  },
  {
    id: 'seguimiento',
    href: '/docente/seguimiento',
    label: 'Seguimiento',
    icon: BookOpenCheckIcon,
  },
] as const

type SeccionDocente = (typeof navegacionDocente)[number]['id']

function esSeccionActiva(seccion: SeccionDocente, pathname: string, hash: string): boolean {
  if (seccion === 'inicio') return pathname === '/docente'
  if (seccion === 'cursos') {
    return pathname === '/docente/cursos' || /^\/docente\/cursos\/[^/]+$/.test(pathname)
  }
  if (seccion === 'asistencia') return pathname.startsWith('/docente/asistencia')
  if (seccion === 'alumnos') {
    return pathname === '/docente/alumnos' || pathname.includes('/alumnos') || hash === '#alumnos'
  }
  if (seccion === 'comunicaciones') return pathname.startsWith('/docente/comunicaciones')
  return (
    pathname === '/docente/seguimiento' ||
    pathname.includes('/seguimiento') ||
    hash === '#seguimiento'
  )
}

export function PortalDocenteLayout() {
  const { pathname, hash } = useLocation()

  function renderNavegacion(clase: string) {
    return (
      <nav aria-label="Navegación del Portal Docente" className={clase}>
        {navegacionDocente.map(({ id, href, label, icon: Icon }) => {
          const activa = esSeccionActiva(id, pathname, hash)
          return (
            <Link
              key={id}
              to={href}
              aria-current={activa ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violeta focus-visible:ring-offset-2',
                activa
                  ? 'bg-violeta-suave text-violeta'
                  : 'text-texto-2 hover:bg-fila-hover hover:text-texto',
              )}
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
    )
  }

  return (
    <div className="min-h-svh bg-lienzo">
      <header className="sticky top-0 z-20">
        <div className="flex h-16 items-center gap-4 border-b border-nav-hover bg-nav px-4 text-texto-sobre-oscuro sm:px-7">
          <Link
            to="/docente"
            className="flex shrink-0 items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lila-claro"
          >
            <span className="flex size-7 items-center justify-center rounded-lg bg-nav-hover">
              <img src="/esseri-icon.png" alt="" className="size-5 object-contain" />
            </span>
            <span className="text-sm font-semibold">ESSERI</span>
          </Link>
          <span aria-hidden="true" className="h-6 w-px bg-texto-2-sobre-oscuro/40" />
          <span className="text-sm font-medium text-texto-sobre-oscuro">Portal Docente</span>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className="flex size-9 items-center justify-center rounded-full text-texto-sobre-oscuro transition-colors hover:bg-nav-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lila-claro"
              aria-label="Notificaciones no disponibles"
              disabled
            >
              <BellIcon aria-hidden="true" className="size-4" />
            </button>
            <MenuCuenta className="hover:bg-nav-hover" />
          </div>
        </div>
        <div className="border-b border-borde bg-superficie px-4 sm:px-7">
          {renderNavegacion('flex gap-1 overflow-x-auto py-2')}
        </div>
      </header>
      <main className="min-w-0 px-4 py-6 sm:px-8">
        <Outlet />
      </main>
    </div>
  )
}
