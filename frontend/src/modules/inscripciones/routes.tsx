import type { RouteObject } from 'react-router'
import { NuevaInscripcionPage } from '@/modules/inscripciones/pages/nueva-inscripcion-page'

export const inscripcionesRoutes: RouteObject[] = [
  {
    path: '/inscripciones/nueva',
    element: <NuevaInscripcionPage />,
  },
]
