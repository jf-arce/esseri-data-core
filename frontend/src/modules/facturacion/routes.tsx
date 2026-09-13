import type { RouteObject } from 'react-router'
import { PermisoRoute } from '@/router/permiso-route'
import { PERMISO_FACTURACION_CREAR, PERMISO_FACTURACION_LEER } from '@/modules/auth/constants'
import { FacturasPage } from '@/modules/facturacion/pages/facturas-page'
import { FacturaDetallePage } from '@/modules/facturacion/pages/factura-detalle-page'
import { DeudaFamiliasPage } from '@/modules/facturacion/pages/deuda-familias-page'
import { NuevaFacturaPage } from '@/modules/facturacion/pages/nueva-factura-page'
import { ReglasFacturacionPage } from '@/modules/facturacion/pages/reglas-facturacion-page'

export const facturacionRoutes: RouteObject[] = [
  {
    element: <PermisoRoute codigo={PERMISO_FACTURACION_LEER} label="Facturación · Leer" />,
    children: [
      { path: '/facturacion', element: <FacturasPage /> },
      { path: '/facturacion/reglas', element: <ReglasFacturacionPage /> },
      { path: '/facturacion/deudas/familias', element: <DeudaFamiliasPage /> },
      { path: '/facturacion/:facturaId', element: <FacturaDetallePage /> },
      {
        element: <PermisoRoute codigo={PERMISO_FACTURACION_CREAR} label="Facturación · Crear" />,
        children: [{ path: '/facturacion/nueva', element: <NuevaFacturaPage /> }],
      },
    ],
  },
]
