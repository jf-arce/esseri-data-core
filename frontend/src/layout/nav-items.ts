import {
  Boxes,
  ClipboardCheck,
  ClipboardList,
  ShieldCheck,
  Truck,
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
    label: 'Gestión',
    items: [
      { label: 'Inscripciones', href: '/inscripciones', icon: ClipboardCheck },
      { label: 'Proveedores', href: '/proveedores', icon: Truck },
      { label: 'Solicitudes de compra', href: '/solicitudes-compra', icon: ClipboardList },
      { label: 'Catálogo de compras', href: '/catalogo-compras', icon: Boxes },
    ],
  },
  {
    label: 'Sistema',
    items: [{ label: 'Usuarios y roles', href: '/configuracion/acceso', icon: ShieldCheck }],
  },
]
