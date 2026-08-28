import type { RouteObject } from 'react-router'
import { InscripcionesPage } from '@/modules/inscripciones/pages/inscripciones-page'
import { NuevaInscripcionPage } from '@/modules/inscripciones/pages/nueva-inscripcion-page'

export const inscripcionesRoutes: RouteObject[] = [
  {
    path: '/inscripciones',
    element: <InscripcionesPage />,
  },
  {
    path: '/inscripciones/nueva',
    element: <NuevaInscripcionPage />,
  },
]
