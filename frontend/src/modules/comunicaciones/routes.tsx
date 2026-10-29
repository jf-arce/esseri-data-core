import type { RouteObject } from 'react-router'
import { PermisoRoute } from '@/router/permiso-route'
import { PERMISO_COMUNICACIONES_CREAR, PERMISO_COMUNICACIONES_LEER } from '@/modules/auth/constants'
import { ComunicacionesPage } from './pages/comunicaciones-page'
import { ComunicacionDetallePage } from './pages/comunicacion-detalle-page'
import { ComunicacionFormPage } from './pages/comunicacion-form-page'

export const comunicacionesRoutes: RouteObject[] = [
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
          { path: 'comunicaciones/nueva', element: <ComunicacionFormPage /> },
          { path: 'comunicaciones/:id/editar', element: <ComunicacionFormPage /> },
        ],
      },
    ],
  },
]
export const comunicacionesFamiliaRoutes: RouteObject[] = [
  {
    element: <PermisoRoute codigo={PERMISO_COMUNICACIONES_LEER} label="Comunicaciones · Leer" />,
    children: [
      { path: 'familia/comunicaciones', element: <ComunicacionesPage familia /> },
      { path: 'familia/comunicaciones/:id', element: <ComunicacionDetallePage familia /> },
    ],
  },
]
