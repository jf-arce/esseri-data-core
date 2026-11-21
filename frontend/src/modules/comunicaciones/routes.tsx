import type { RouteObject } from 'react-router'
import { PermisoRoute } from '@/router/permiso-route'
import { PERMISO_COMUNICACIONES_CREAR, PERMISO_COMUNICACIONES_LEER } from '@/modules/auth/constants'
import { ComunicacionesPage } from './pages/comunicaciones-page'
import { ComunicacionDetallePage } from './pages/comunicacion-detalle-page'
import { ComunicacionFormDiferido } from './pages/comunicacion-form-diferido'
import { ConversacionContextualPage } from './pages/conversacion-contextual-page'
import { ConversacionesPage } from './pages/conversaciones-page'
import { MisConsultasPage } from './pages/mis-consultas-page'

export const comunicacionesRoutes: RouteObject[] = [
  { path: 'comunicaciones/conversaciones', element: <ConversacionesPage /> },
  { path: 'comunicaciones/conversaciones/:id', element: <ConversacionesPage /> },
  {
    path: 'comunicaciones/conversaciones/contextos/:tipo/:contextoId',
    element: <ConversacionContextualPage />,
  },
  {
    element: <PermisoRoute codigo={PERMISO_COMUNICACIONES_LEER} label="Comunicaciones · Leer" />,
    children: [
      { path: 'comunicaciones', element: <ComunicacionesPage /> },
      { path: 'comunicaciones/:id', element: <ComunicacionDetallePage /> },
      {
        element: (
          <PermisoRoute codigo={PERMISO_COMUNICACIONES_CREAR} label="Comunicaciones · Crear" />
        ),
        children: [
          { path: 'comunicaciones/nueva', element: <ComunicacionFormDiferido /> },
          { path: 'comunicaciones/:id/editar', element: <ComunicacionFormDiferido /> },
        ],
      },
    ],
  },
]
export const comunicacionesDocenteRoutes: RouteObject[] = [
  { path: 'docente/comunicaciones', element: <ComunicacionesPage docente /> },
  { path: 'docente/comunicaciones/nueva', element: <ComunicacionFormDiferido docente /> },
  { path: 'docente/comunicaciones/:id', element: <ComunicacionDetallePage docente /> },
  { path: 'docente/comunicaciones/:id/editar', element: <ComunicacionFormDiferido docente /> },
]

export const comunicacionesFamiliaRoutes: RouteObject[] = [
  { path: 'familia/consultas', element: <MisConsultasPage /> },
  { path: 'familia/conversaciones/:id', element: <ConversacionContextualPage familia /> },
  {
    path: 'familia/conversaciones/contextos/:tipo/:contextoId',
    element: <ConversacionContextualPage familia />,
  },
  {
    element: <PermisoRoute codigo={PERMISO_COMUNICACIONES_LEER} label="Comunicaciones · Leer" />,
    children: [
      { path: 'familia/comunicaciones', element: <ComunicacionesPage familia /> },
      { path: 'familia/comunicaciones/:id', element: <ComunicacionDetallePage familia /> },
    ],
  },
]
