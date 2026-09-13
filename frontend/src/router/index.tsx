import { useRoutes } from 'react-router'
import { AppLayout } from '@/layout/app-layout'
import { ElegirPerfilPage } from '@/pages/elegir-perfil-page'
import { ProtectedRoute } from '@/router/protected-route'
import { RolActivoRoute } from '@/router/rol-activo-route'
import { InicioRoute } from '@/router/inicio-route'
import { authPrivateRoutes, authRoutes } from '@/modules/auth/routes'
import { familiasAlumnosRoutes } from '@/modules/familias-alumnos/routes'
import { academicoRoutes } from '@/modules/academico/routes'
import { inscripcionesRoutes } from '@/modules/inscripciones/routes'
import { facturacionRoutes } from '@/modules/facturacion/routes'
import { proveedoresComprasRoutes } from '@/modules/proveedores-compras/routes'
import { workflowsRoutes } from '@/modules/workflows/routes'
import { auditoriaRoutes } from '@/modules/auditoria/routes'
import { panelAdminRoutes } from '@/modules/panel-admin/routes'
import { iaSugerenciasRoutes } from '@/modules/ia-sugerencias/routes'

const moduleRoutes = [
  ...authPrivateRoutes,
  ...familiasAlumnosRoutes,
  ...academicoRoutes,
  ...inscripcionesRoutes,
  ...facturacionRoutes,
  ...proveedoresComprasRoutes,
  ...workflowsRoutes,
  ...auditoriaRoutes,
  ...panelAdminRoutes,
  ...iaSugerenciasRoutes,
]

export function AppRouter() {
  return useRoutes([
    ...authRoutes,
    {
      element: <ProtectedRoute />,
      children: [
        // Fuera del shell (sin sidebar): con sesión pero sin rol activo todavía elegido,
        // `RolActivoRoute` manda acá antes de mostrar nada del panel.
        { path: '/elegir-perfil', element: <ElegirPerfilPage /> },
        {
          element: <RolActivoRoute />,
          children: [
            {
              element: <AppLayout />,
              children: [{ index: true, element: <InicioRoute /> }, ...moduleRoutes],
            },
          ],
        },
      ],
    },
  ])
}
