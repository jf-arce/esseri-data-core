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
    // "administrador del sistema" también entra acá (grupo-b.yaml: "administrador del sistema
    // = todo", CRUD completo en los 10 módulos) — su *pantalla de inicio* por default es
    // /panel (ver `rutaInicioDe` en nav-items.ts), pero eso no le saca acceso a /admin: puede
    // navegar a los dos paneles desde el sidebar, a diferencia de Dirección/Administración que
    // solo ven el suyo.
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
