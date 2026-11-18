import type { RouteObject } from 'react-router'
import { PermisoRoute } from '@/router/permiso-route'
import { PERMISO_AUDITORIA_LEER } from '@/modules/auth/constants'
import { RUTA_AUDITORIA } from '@/modules/auditoria/constants'
import { AuditoriaPage } from '@/modules/auditoria/pages/auditoria-page'

export const auditoriaRoutes: RouteObject[] = [
  {
    element: <PermisoRoute codigo={PERMISO_AUDITORIA_LEER} label="Auditoría · Leer" />,
    children: [{ path: RUTA_AUDITORIA, element: <AuditoriaPage /> }],
  },
]
