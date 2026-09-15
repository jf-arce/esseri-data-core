import type { RouteObject } from 'react-router'
import { PortalFamiliaPage } from '@/pages/portal-familia-page'
import { PortalFamiliaTramitePage } from '@/pages/portal-familia-tramite-page'

// Las rutas de IA para backoffice llegarán en otra entrega. Esta vista se monta dentro del
// `VistaRoute` de Familia, por lo que no queda disponible desde los shells de gestión o docente.
export const iaSugerenciasRoutes: RouteObject[] = []

export const iaSugerenciasFamiliaRoutes: RouteObject[] = [
  { path: 'familia', element: <PortalFamiliaPage /> },
  {
    path: 'familia/justificar-ausencia',
    element: (
      <PortalFamiliaTramitePage
        titulo="Justificar una ausencia"
        descripcion="Informá el motivo de la ausencia y adjuntá el comprobante correspondiente."
      />
    ),
  },
  {
    path: 'familia/facturacion',
    element: (
      <PortalFamiliaTramitePage
        titulo="Facturación"
        descripcion="Consultá facturas, vencimientos, pagos y el estado de cuenta de tu familia."
      />
    ),
  },
]
