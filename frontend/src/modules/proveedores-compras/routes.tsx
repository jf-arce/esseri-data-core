import type { RouteObject } from 'react-router'
import { ProveedoresPage } from '@/modules/proveedores-compras/pages/proveedores-page'

export const proveedoresComprasRoutes: RouteObject[] = [
  {
    path: '/proveedores',
    element: <ProveedoresPage />,
  },
]
