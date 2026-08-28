import { ShieldCheck, type LucideIcon } from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

// Cada módulo suma su propia línea acá cuando tenga una página real: por ahora el único
// destino real del sistema es la administración de roles y permisos (issue #15). El grupo
// "Gestión" queda declarado vacío a propósito — no se dibujan ítems muertos (§8 DESIGN.md).
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Sistema',
    items: [{ label: 'Usuarios y roles', href: '/configuracion/acceso', icon: ShieldCheck }],
  },
]
