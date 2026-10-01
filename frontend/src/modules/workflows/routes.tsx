import type { RouteObject } from 'react-router'
import { PermisoRoute } from '@/router/permiso-route'
import { PERMISO_WORKFLOWS_CREAR, PERMISO_WORKFLOWS_LEER } from '@/modules/auth/constants'
import { ReglasWorkflowPage } from '@/modules/workflows/pages/reglas-workflow-page'
import { ReglaWorkflowEditorPage } from '@/modules/workflows/pages/regla-workflow-editor-page'

export const workflowsRoutes: RouteObject[] = [
  {
    element: <PermisoRoute codigo={PERMISO_WORKFLOWS_LEER} label="Workflows · Leer" />,
    children: [
      { path: '/workflows/reglas', element: <ReglasWorkflowPage /> },
      {
        element: <PermisoRoute codigo={PERMISO_WORKFLOWS_CREAR} label="Workflows · Crear" />,
        children: [{ path: '/workflows/reglas/nueva', element: <ReglaWorkflowEditorPage /> }],
      },
      { path: '/workflows/reglas/:reglaId', element: <ReglaWorkflowEditorPage /> },
    ],
  },
]
