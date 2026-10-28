import type { RouteObject } from 'react-router'
import { PermisoRoute } from '@/router/permiso-route'
import { PERMISO_WORKFLOWS_CREAR, PERMISO_WORKFLOWS_LEER } from '@/modules/auth/constants'
import {
  RUTA_EJECUCIONES,
  RUTA_NOTIFICACIONES,
  RUTA_NUEVA_REGLA,
  RUTA_REGLA_POR_ID,
  RUTA_REGLAS,
  RUTA_TAREAS,
} from '@/modules/workflows/constants'
import { EjecucionesWorkflowPage } from '@/modules/workflows/pages/ejecuciones-workflow-page'
import { NotificacionesPage } from '@/modules/workflows/pages/notificaciones-page'
import { ReglasWorkflowPage } from '@/modules/workflows/pages/reglas-workflow-page'
import { TareasPage } from '@/modules/workflows/pages/tareas-page'
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
      { path: RUTA_EJECUCIONES, element: <EjecucionesWorkflowPage /> },
      { path: RUTA_NOTIFICACIONES, element: <NotificacionesPage /> },
    ],
  },
  // La bandeja es de cada persona: no pide permisos de Workflows. Sin `workflows.leer` el backend
  // devuelve solo las tareas asignadas a quien consulta.
  { path: RUTA_TAREAS, element: <TareasPage /> },
]
