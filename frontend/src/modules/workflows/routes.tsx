import type { RouteObject } from 'react-router'
import { PermisoRoute } from '@/router/permiso-route'
import { PERMISO_WORKFLOWS_LEER } from '@/modules/auth/constants'
import { ReglasWorkflowPage } from '@/modules/workflows/pages/reglas-workflow-page'

export const workflowsRoutes: RouteObject[] = [
  {
    element: <PermisoRoute codigo={PERMISO_WORKFLOWS_LEER} label="Workflows · Leer" />,
    children: [{ path: '/workflows/reglas', element: <ReglasWorkflowPage /> }],
  },
]
