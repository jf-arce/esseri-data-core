import type { RouteObject } from 'react-router'
import { InscripcionesPage } from '@/modules/inscripciones/pages/inscripciones-page'
import { NuevaInscripcionPage } from '@/modules/inscripciones/pages/nueva-inscripcion-page'
import { AdmisionesPage } from '@/modules/inscripciones/pages/admisiones-page'
import { SolicitudAdmisionPage } from '@/modules/inscripciones/pages/solicitud-admision-page'

export const inscripcionesRoutes: RouteObject[] = [
  {
    path: '/inscripciones',
    element: <InscripcionesPage />,
  },
  {
    path: '/inscripciones/nueva',
    element: <NuevaInscripcionPage />,
  },
  {
    path: '/inscripciones/admisiones',
    element: <AdmisionesPage />,
  },
  {
    path: '/inscripciones/admisiones/:solicitudId',
    element: <SolicitudAdmisionPage />,
  },
]
