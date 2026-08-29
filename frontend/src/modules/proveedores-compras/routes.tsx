import type { RouteObject } from 'react-router'
import { CatalogoPage } from '@/modules/proveedores-compras/pages/catalogo-page'
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
  {
    path: '/catalogo-compras',
    element: <CatalogoPage />,
  },
]
