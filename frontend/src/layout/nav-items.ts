import {
  Boxes,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  BookOpenIcon,
  Landmark,
  LayoutDashboard,
  ReceiptText,
  ShieldCheck,
  Truck,
  UsersRound,
  UserCog,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

// Cada módulo suma su propia línea acá cuando tenga una página real. No se dibujan ítems
// muertos: cada href tiene que apuntar a una ruta implementada (§8 DESIGN.md).
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
      { label: 'Familias', href: '/familias-alumnos', icon: UsersRound },
      { label: 'Alumnos', href: '/familias-alumnos/alumnos', icon: GraduationCap },
      { label: 'Académico', href: '/academico', icon: BookOpenIcon },
      { label: 'Asignaciones docentes', href: '/academico/asignaciones', icon: UserCog },
      { label: 'Inscripciones', href: '/inscripciones', icon: ClipboardCheck },
      { label: 'Facturación', href: '/facturacion', icon: Landmark },
      { label: 'Proveedores', href: '/proveedores', icon: Truck },
      { label: 'Solicitudes de compra', href: '/solicitudes-compra', icon: ClipboardList },
      { label: 'Órdenes de compra', href: '/ordenes-compra', icon: ReceiptText },
      { label: 'Catálogo de compras', href: '/catalogo-compras', icon: Boxes },
    ],
  },
  {
    label: 'Sistema',
    items: [{ label: 'Usuarios y roles', href: '/configuracion/acceso', icon: ShieldCheck }],
  },
]
