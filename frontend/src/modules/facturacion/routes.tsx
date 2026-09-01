import type { RouteObject } from 'react-router'
import { FacturasPage } from '@/modules/facturacion/pages/facturas-page'
import { FacturaDetallePage } from '@/modules/facturacion/pages/factura-detalle-page'
import { NuevaFacturaPage } from '@/modules/facturacion/pages/nueva-factura-page'
import { ReglasFacturacionPage } from '@/modules/facturacion/pages/reglas-facturacion-page'

export const facturacionRoutes: RouteObject[] = [
  { path: '/facturacion', element: <FacturasPage /> },
  { path: '/facturacion/nueva', element: <NuevaFacturaPage /> },
  { path: '/facturacion/reglas', element: <ReglasFacturacionPage /> },
  { path: '/facturacion/:facturaId', element: <FacturaDetallePage /> },
]
