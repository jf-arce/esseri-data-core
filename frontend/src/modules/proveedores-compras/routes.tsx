import type { RouteObject } from 'react-router'
import { ProveedoresPage } from '@/modules/proveedores-compras/pages/proveedores-page'
import { SolicitudesPage } from '@/modules/proveedores-compras/pages/solicitudes-page'

export const proveedoresComprasRoutes: RouteObject[] = [
  {
    path: '/proveedores',
    element: <ProveedoresPage />,
  },
  {
    path: '/solicitudes-compra',
    element: <SolicitudesPage />,
  },
]
