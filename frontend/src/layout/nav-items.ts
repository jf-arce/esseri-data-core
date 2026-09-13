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
import {
  PERMISO_ACADEMICO_ACTUALIZAR_ASISTENCIA,
  PERMISO_ACADEMICO_LEER,
  PERMISO_AUTENTICACION_LEER,
  PERMISO_FACTURACION_LEER,
  PERMISO_FAMILIAS_ALUMNOS_LEER,
  PERMISO_INSCRIPCIONES_LEER,
  PERMISO_PANEL_ADMIN_LEER,
  PERMISO_PROVEEDORES_COMPRAS_LEER,
  ROL_ADMINISTRACION,
  ROL_ADMINISTRADOR_DEL_SISTEMA,
  ROL_DIRECCION,
  ROL_DOCENTE,
  ROL_FAMILIA,
  tienePermiso,
} from '@/modules/auth/constants'
import type { Permiso } from '@/modules/auth/types'

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
  /** Permiso `.leer` que habilita ver este ítem (mismo código que protege la ruta con
   * `PermisoRoute`). Ausente en ítems que solo agrupan hijos sin landing propia — ahí el
   * filtro corre por los hijos. */
  permiso?: string
  /** Además del permiso, restringe el ítem a estos roles (ej. los paneles: mismo permiso,
   * pero cada uno es de un rol distinto). */
  roles?: string[]
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

/** Qué shell le corresponde al rol activo (§8 DESIGN.md): Consola (rail lateral, ~10 destinos)
 * para los roles de gestión, Portal (nav de píldoras arriba) para Docente y Familia, que tienen
 * 3 destinos o menos y además tienen su propio flujo, sin nada que ver con el de backoffice. */
export type Vista = 'consola' | 'docente' | 'familia'

export function vistaDe(rolActivo: string | null): Vista {
  if (rolActivo === ROL_DOCENTE) return 'docente'
  if (rolActivo === ROL_FAMILIA) return 'familia'
  return 'consola'
}

// Cada módulo suma su propia línea acá cuando tenga una página real. No se dibujan ítems
// muertos: cada href tiene que apuntar a una ruta implementada (§8 DESIGN.md). Workflows,
// Auditoría y Sugerencias de IA existen como módulo pero sus routes.tsx todavía están vacíos
// (`RouteObject[] = []`) — se agregan acá cuando tengan una página real.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Paneles',
    items: [
      {
        label: 'Panel de Dirección',
        href: '/panel',
        icon: LayoutDashboard,
        permiso: PERMISO_PANEL_ADMIN_LEER,
        roles: [ROL_DIRECCION, ROL_ADMINISTRADOR_DEL_SISTEMA],
      },
      {
        label: 'Panel Administrativo',
        href: '/admin',
        icon: LayoutDashboard,
        permiso: PERMISO_PANEL_ADMIN_LEER,
        // administrador del sistema = todo (grupo-b.yaml): ve los dos paneles en el sidebar,
        // aunque su pantalla de inicio por default sea /panel (ver rutaInicioDe más abajo).
        roles: [ROL_ADMINISTRACION, ROL_ADMINISTRADOR_DEL_SISTEMA],
      },
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
        permiso: PERMISO_FAMILIAS_ALUMNOS_LEER,
        children: [{ label: 'Alumnos', href: '/familias-alumnos/alumnos', icon: GraduationCap }],
      },
      {
        // Gestión de la estructura curricular (RF de Académico): pide el `.leer` para ENTRAR
        // (dirección la mira sin operarla — "visión completa, exporta, pero no opera el día a
        // día", grupo-b.yaml), no el `actualizar` de escritura — eso solo condiciona los
        // botones de crear/editar/eliminar dentro de la página, no el acceso a verla. Un
        // docente también tiene `academico.leer`, pero nunca llega a este árbol de consola:
        // `VistaRoute` lo manda a su propio Portal antes de que este permiso importe.
        label: 'Académico',
        href: '/academico',
        tituloLanding: 'Estructura académica',
        icon: BookOpenIcon,
        permiso: PERMISO_ACADEMICO_LEER,
        children: [
          { label: 'Asignaciones docentes', href: '/academico/asignaciones', icon: UserCog },
          {
            // Solo para roles de consola que también toman asistencia (secretaría, coordinación
            // académica, administrador del sistema, y dirección si en algún momento la
            // necesita) — el docente toma asistencia desde su propio Portal, fuera de este
            // árbol de consola. OJO: como hijo, este ítem solo se evalúa si el padre pasa antes
            // su propio `permiso` (`academico.leer`) — hoy todo rol de consola con permiso de
            // asistencia también tiene `.leer`, así que es seguro; si algún día existiera un
            // rol de consola con asistencia pero sin `.leer`, este ítem quedaría oculto y habría
            // que revisar `itemVisible`/`filtrarNav`.
            label: 'Tomar asistencia',
            href: '/academico/asistencia',
            icon: CalendarCheck,
            permiso: PERMISO_ACADEMICO_ACTUALIZAR_ASISTENCIA,
          },
        ],
      },
      {
        label: 'Inscripciones',
        href: '/inscripciones',
        tituloLanding: 'Inscripciones',
        icon: ClipboardCheck,
        permiso: PERMISO_INSCRIPCIONES_LEER,
        children: [{ label: 'Admisiones', href: '/inscripciones/admisiones', icon: UserPlusIcon }],
      },
      {
        label: 'Facturación',
        href: '/facturacion',
        tituloLanding: 'Facturas',
        icon: Landmark,
        permiso: PERMISO_FACTURACION_LEER,
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
        permiso: PERMISO_PROVEEDORES_COMPRAS_LEER,
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
        href: '/usuarios-roles',
        icon: ShieldCheck,
        permiso: PERMISO_AUTENTICACION_LEER,
        children: [
          { label: 'Usuarios', href: '/usuarios-roles/usuarios', icon: UserIcon },
          { label: 'Roles', href: '/usuarios-roles/roles', icon: IdCardIcon },
          { label: 'Permisos', href: '/usuarios-roles/permisos', icon: KeyRoundIcon },
          {
            label: 'Matriz de permisos',
            href: '/usuarios-roles/matriz',
            icon: Grid3x3Icon,
          },
        ],
      },
    ],
  },
]

// Ítem visible si tiene el permiso `.leer` que declara (los que no declaran ninguno, como
// "Proveedores y compras" que agrupa hijos sin landing propia, se filtran por sus hijos) y,
// cuando declara `roles`, si el rol activo está entre ellos.
function itemVisible(item: NavItem, rolActivo: string | null, permisos: Permiso[]): boolean {
  if (item.roles && (rolActivo === null || !item.roles.includes(rolActivo))) return false
  if (item.permiso && !tienePermiso(permisos, item.permiso)) return false
  return true
}

/** El árbol de navegación acotado a lo que el rol activo puede ver: descarta ítems e hijos sin
 * acceso, y un padre que se queda sin ningún hijo visible ni landing propia. Un grupo sin
 * ítems visibles desaparece entero. Usado por el sidebar, el buscador global y `rutaInicioDe`. */
export function filtrarNav(
  grupos: NavGroup[],
  rolActivo: string | null,
  permisos: Permiso[],
): NavGroup[] {
  return grupos
    .map((grupo) => ({
      ...grupo,
      items: grupo.items
        .filter((item) => itemVisible(item, rolActivo, permisos))
        .map((item) => {
          if (!item.children) return item
          const hijos = item.children.filter((hijo) => itemVisible(hijo, rolActivo, permisos))
          return { ...item, children: hijos }
        })
        .filter((item) => item.href || (item.children && item.children.length > 0)),
    }))
    .filter((grupo) => grupo.items.length > 0)
}

/** La pantalla principal del rol activo. Para Docente/Familia (Portal, todavía sin pantallas
 * propias — lo construye otro integrante del equipo), directo `/<vista>`: esa ruta es hoy una
 * página en blanco. Para el resto (Consola), el primer href de `NAV_GROUPS` ya filtrado por
 * permisos — los paneles (Dirección/Administración) tienen prioridad porque son la landing
 * "propia" del rol, no un módulo compartido con otros roles. `null` solo puede pasar en
 * Consola sin ningún acceso — pantalla "sin acceso" en vez de un `/` sin nada que mostrar. */
export function rutaInicioDe(rolActivo: string | null, permisos: Permiso[]): string | null {
  const vista = vistaDe(rolActivo)
  if (vista !== 'consola') return `/${vista}`

  const filtrado = filtrarNav(NAV_GROUPS, rolActivo, permisos)
  const panel = filtrado[0]?.items.find((item) => item.href === '/panel' || item.href === '/admin')
  if (panel?.href) return panel.href

  for (const grupo of filtrado) {
    for (const item of grupo.items) {
      if (item.href) return item.href
      const primerHijo = item.children?.find((hijo) => hijo.href)
      if (primerHijo?.href) return primerHijo.href
    }
  }
  return null
}

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
