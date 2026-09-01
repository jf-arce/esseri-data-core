import type { RouteObject } from 'react-router'
import { PermisoRoute } from '@/router/permiso-route'
import { RoleRoute } from '@/router/role-route'
import { PERMISO_PANEL_ADMIN_LEER } from '@/modules/auth/constants'
import { PanelAdministracionPage } from '@/modules/panel-admin/pages/panel-administracion-page'
import { PanelDireccionPage } from '@/modules/panel-admin/pages/panel-direccion-page'

export const panelAdminRoutes: RouteObject[] = [
  {
    element: <RoleRoute allowedRoles={['dirección', 'administrador del sistema']} />,
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
    element: <RoleRoute allowedRoles={['administración', 'administrador del sistema']} />,
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
