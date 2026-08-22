import { useRoutes } from 'react-router'
import { AppLayout } from '@/layout/app-layout'
import { WelcomePage } from '@/pages/welcome-page'
import { authRoutes } from '@/modules/auth/routes'
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
    { index: true, element: <WelcomePage /> },
    ...authRoutes,
    { element: <AppLayout />, children: moduleRoutes },
  ])
}
