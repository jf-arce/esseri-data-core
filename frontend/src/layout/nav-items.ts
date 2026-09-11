import {
  Boxes,
  Building2Icon,
  CalendarCheck,
  ClipboardCheck,
  ClipboardList,
  Grid3x3Icon,
  GraduationCap,
  BookOpenIcon,
  HandCoinsIcon,
  IdCardIcon,
  KeyRoundIcon,
  Landmark,
  LayoutDashboard,
  ReceiptText,
  Settings2Icon,
  ShieldCheck,
  Truck,
  UserCog,
  UserIcon,
  UserPlusIcon,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  /** Ausente cuando el ítem es solo el disparador de un desplegable sin landing propia
   * (ej. "Proveedores y compras"): en ese caso, `children` siempre está presente. */
  href?: string
  /** Título real de la landing del módulo (el `<h1>` que el usuario ve en esa página), usado
   * como nombre de la fila de entrada en el panel del sidebar — nunca un "General" genérico.
   * Ausente cuando `href` no tiene contenido propio (ej. "Usuarios y roles", que solo redirige
   * a su primer hijo): en ese caso no se agrega fila sintética, el hijo ya cubre ese lugar. */
  tituloLanding?: string
  icon: LucideIcon
  children?: NavItem[]
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

// Cada módulo suma su propia línea acá cuando tenga una página real. No se dibujan ítems
// muertos: cada href tiene que apuntar a una ruta implementada (§8 DESIGN.md). Workflows,
// Auditoría y Sugerencias de IA existen como módulo pero sus routes.tsx todavía están vacíos
// (`RouteObject[] = []`) — se agregan acá cuando tengan una página real.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Paneles',
    items: [
      { label: 'Panel de Dirección', href: '/panel', icon: LayoutDashboard },
      { label: 'Panel Administrativo', href: '/admin', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Gestión',
    items: [
      {
        // El label es el link a la landing del módulo (§8 DESIGN.md); el desplegable solo
        // suma los destinos DISTINTOS de esa landing — nunca la repite como primer ítem.
        label: 'Familias y alumnos',
        href: '/familias-alumnos',
        tituloLanding: 'Familias',
        icon: UsersRound,
        children: [{ label: 'Alumnos', href: '/familias-alumnos/alumnos', icon: GraduationCap }],
      },
      {
        label: 'Académico',
        href: '/academico',
        tituloLanding: 'Estructura académica',
        icon: BookOpenIcon,
        children: [
          { label: 'Asignaciones docentes', href: '/academico/asignaciones', icon: UserCog },
          { label: 'Tomar asistencia', href: '/academico/asistencia', icon: CalendarCheck },
        ],
      },
      {
        label: 'Inscripciones',
        href: '/inscripciones',
        tituloLanding: 'Inscripciones',
        icon: ClipboardCheck,
        children: [{ label: 'Admisiones', href: '/inscripciones/admisiones', icon: UserPlusIcon }],
      },
      {
        label: 'Facturación',
        href: '/facturacion',
        tituloLanding: 'Facturas',
        icon: Landmark,
        children: [
          {
            label: 'Deuda por familia',
            href: '/facturacion/deudas/familias',
            icon: HandCoinsIcon,
          },
          { label: 'Reglas de facturación', href: '/facturacion/reglas', icon: Settings2Icon },
        ],
      },
      {
        label: 'Proveedores y compras',
        icon: Truck,
        children: [
          { label: 'Proveedores', href: '/proveedores', icon: Building2Icon },
          { label: 'Solicitudes de compra', href: '/solicitudes-compra', icon: ClipboardList },
          { label: 'Órdenes de compra', href: '/ordenes-compra', icon: ReceiptText },
          { label: 'Catálogo de compras', href: '/catalogo-compras', icon: Boxes },
        ],
      },
    ],
  },
  {
    label: 'Sistema',
    items: [
      {
        label: 'Usuarios y roles',
        href: '/configuracion/acceso',
        icon: ShieldCheck,
        children: [
          { label: 'Usuarios', href: '/configuracion/acceso/usuarios', icon: UserIcon },
          { label: 'Roles', href: '/configuracion/acceso/roles', icon: IdCardIcon },
          { label: 'Permisos', href: '/configuracion/acceso/permisos', icon: KeyRoundIcon },
          {
            label: 'Matriz de permisos',
            href: '/configuracion/acceso/matriz',
            icon: Grid3x3Icon,
          },
        ],
      },
    ],
  },
]

// Compara por segmento de ruta, no por prefijo de string crudo: `/panel` no debe activarse con
// `/panel-algo`, y `esRutaActiva('/familias-alumnos', '/familias-alumnos/alumnos')` es false
// (evita el bug de dos ítems activos a la vez cuando un href es prefijo textual de otro).
function esRutaActiva(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** Todos los hrefs (padre + hijos) de un ítem, del más específico al menos específico. */
function hrefsDe(item: NavItem): string[] {
  const propios = item.href ? [item.href] : []
  const hijos = item.children?.flatMap(hrefsDe) ?? []
  return [...propios, ...hijos]
}

// Entre todos los hrefs de todo el árbol de navegación, el activo es el match MÁS LARGO —
// así una ruta como `/familias-alumnos/alumnos` activa solo "Alumnos", no también "Familias y
// alumnos" (que además comparte el mismo href que su hijo "Familias").
export function calcularHrefActivo(pathname: string, grupos: NavGroup[]): string | null {
  let mejor: string | null = null
  for (const grupo of grupos) {
    for (const item of grupo.items) {
      for (const href of hrefsDe(item)) {
        if (esRutaActiva(pathname, href) && (mejor === null || href.length > mejor.length)) {
          mejor = href
        }
      }
    }
  }
  return mejor
}

/** El item (padre o hijo) cuyo href es exactamente el activo calculado. */
export function esItemActivo(item: NavItem, hrefActivo: string | null): boolean {
  return item.href === hrefActivo
}

/** Un padre se marca "abierto" si el activo cae en él o en alguno de sus hijos. */
export function contieneRutaActiva(item: NavItem, pathname: string): boolean {
  return hrefsDe(item).some((href) => esRutaActiva(pathname, href))
}
