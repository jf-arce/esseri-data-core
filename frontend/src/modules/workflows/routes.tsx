import type { RouteObject } from 'react-router'
import { PermisoRoute } from '@/router/permiso-route'
import { PERMISO_WORKFLOWS_CREAR, PERMISO_WORKFLOWS_LEER } from '@/modules/auth/constants'
import { RUTA_NUEVA_REGLA, RUTA_REGLA_POR_ID, RUTA_REGLAS } from '@/modules/workflows/constants'
import { ReglasWorkflowPage } from '@/modules/workflows/pages/reglas-workflow-page'
import { ReglaWorkflowEditorPage } from '@/modules/workflows/pages/regla-workflow-editor-page'

export const workflowsRoutes: RouteObject[] = [
  {
    element: <PermisoRoute codigo={PERMISO_WORKFLOWS_LEER} label="Workflows · Leer" />,
    children: [
      { path: RUTA_REGLAS, element: <ReglasWorkflowPage /> },
      {
        element: <PermisoRoute codigo={PERMISO_WORKFLOWS_CREAR} label="Workflows · Crear" />,
        children: [{ path: RUTA_NUEVA_REGLA, element: <ReglaWorkflowEditorPage /> }],
      },
      { path: RUTA_REGLA_POR_ID, element: <ReglaWorkflowEditorPage /> },
    ],
  },
]
