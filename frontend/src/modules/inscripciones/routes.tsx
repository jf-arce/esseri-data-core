import type { RouteObject } from 'react-router'
import { PermisoRoute } from '@/router/permiso-route'
import { PERMISO_INSCRIPCIONES_CREAR, PERMISO_INSCRIPCIONES_LEER } from '@/modules/auth/constants'
import { InscripcionesPage } from '@/modules/inscripciones/pages/inscripciones-page'
import { NuevaInscripcionPage } from '@/modules/inscripciones/pages/nueva-inscripcion-page'
import { AdmisionesPage } from '@/modules/inscripciones/pages/admisiones-page'
import { NuevaAdmisionPage } from '@/modules/inscripciones/pages/nueva-admision-page'
import { SolicitudAdmisionPage } from '@/modules/inscripciones/pages/solicitud-admision-page'

export const inscripcionesRoutes: RouteObject[] = [
  {
    element: <PermisoRoute codigo={PERMISO_INSCRIPCIONES_LEER} label="Inscripciones · Leer" />,
    children: [
      { path: '/inscripciones', element: <InscripcionesPage /> },
      { path: '/inscripciones/admisiones', element: <AdmisionesPage /> },
      { path: '/inscripciones/admisiones/:solicitudId', element: <SolicitudAdmisionPage /> },
      {
        element: (
          <PermisoRoute codigo={PERMISO_INSCRIPCIONES_CREAR} label="Inscripciones · Crear" />
        ),
        children: [
          { path: '/inscripciones/nueva', element: <NuevaInscripcionPage /> },
          { path: '/inscripciones/admisiones/nueva', element: <NuevaAdmisionPage /> },
        ],
      },
    ],
  },
]
