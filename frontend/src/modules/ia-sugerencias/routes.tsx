import type { RouteObject } from 'react-router'
import { PERMISO_IA_SUGERENCIAS_LEER, RUTA_SUGERENCIAS } from '@/modules/ia-sugerencias/constants'
import { SugerenciasPage } from '@/modules/ia-sugerencias/pages/sugerencias-page'
import { PortalFamiliaPage } from '@/pages/portal-familia-page'
import { PortalFamiliaTramitePage } from '@/pages/portal-familia-tramite-page'
import { PermisoRoute } from '@/router/permiso-route'

export const iaSugerenciasRoutes: RouteObject[] = [
  {
    element: <PermisoRoute codigo={PERMISO_IA_SUGERENCIAS_LEER} label="IA/Sugerencias · Leer" />,
    children: [{ path: RUTA_SUGERENCIAS, element: <SugerenciasPage /> }],
  },
]

// Esta vista se monta dentro del `VistaRoute` de Familia, por lo que no queda disponible
// desde los shells de gestión o docente.

export const iaSugerenciasFamiliaRoutes: RouteObject[] = [
  { path: 'familia', element: <PortalFamiliaPage /> },
  {
    path: 'familia/asistencias',
    element: (
      <PortalFamiliaTramitePage
        titulo="Asistencias"
        descripcion="Consultá el resumen, justificá ausencias y revisá el historial de asistencia."
      />
    ),
  },
  {
    path: 'familia/justificar-ausencia',
    element: (
      <PortalFamiliaTramitePage
        titulo="Asistencias"
        descripcion="Informá el motivo de la ausencia y adjuntá el comprobante correspondiente."
        seccionInicial="pendientes"
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
