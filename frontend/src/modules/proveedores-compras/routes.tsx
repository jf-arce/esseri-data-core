import type { RouteObject } from 'react-router'
import { PermisoRoute } from '@/router/permiso-route'
import { PERMISO_PROVEEDORES_COMPRAS_LEER } from '@/modules/auth/constants'
import { CatalogoPage } from '@/modules/proveedores-compras/pages/catalogo-page'
import { OrdenesPage } from '@/modules/proveedores-compras/pages/ordenes-page'
import { ProveedoresPage } from '@/modules/proveedores-compras/pages/proveedores-page'
import { SolicitudesPage } from '@/modules/proveedores-compras/pages/solicitudes-page'

export const proveedoresComprasRoutes: RouteObject[] = [
  {
    element: (
      <PermisoRoute
        codigo={PERMISO_PROVEEDORES_COMPRAS_LEER}
        label="Proveedores y Compras · Leer"
      />
    ),
    children: [
      { path: '/proveedores', element: <ProveedoresPage /> },
      { path: '/solicitudes-compra', element: <SolicitudesPage /> },
      { path: '/ordenes-compra', element: <OrdenesPage /> },
      { path: '/catalogo-compras', element: <CatalogoPage /> },
    ],
  },
]
