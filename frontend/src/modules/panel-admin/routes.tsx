import type { RouteObject } from 'react-router'
import { PermisoRoute } from '@/router/permiso-route'
import { RoleRoute } from '@/router/role-route'
import {
  PERMISO_PANEL_ADMIN_LEER,
  ROL_ADMINISTRACION,
  ROL_ADMINISTRADOR_DEL_SISTEMA,
  ROL_DIRECCION,
} from '@/modules/auth/constants'
import { PanelAdministracionPage } from '@/modules/panel-admin/pages/panel-administracion-page'
import { PanelDireccionPage } from '@/modules/panel-admin/pages/panel-direccion-page'

export const panelAdminRoutes: RouteObject[] = [
  {
    element: <RoleRoute allowedRoles={[ROL_DIRECCION, ROL_ADMINISTRADOR_DEL_SISTEMA]} />,
    children: [
      {
        element: (
          <PermisoRoute codigo={PERMISO_PANEL_ADMIN_LEER} label="Panel Administrativo · Leer" />
        ),
        children: [{ path: '/panel', element: <PanelDireccionPage /> }],
      },
    ],
  },
  {
    element: <RoleRoute allowedRoles={[ROL_ADMINISTRACION, ROL_ADMINISTRADOR_DEL_SISTEMA]} />,
    children: [
      {
        element: (
          <PermisoRoute codigo={PERMISO_PANEL_ADMIN_LEER} label="Panel Administrativo · Leer" />
        ),
        children: [{ path: '/admin', element: <PanelAdministracionPage /> }],
      },
    ],
  },
]
