import type { RouteObject } from 'react-router'
import { PermisoRoute } from '@/router/permiso-route'
import {
  PERMISO_ACADEMICO_ACTUALIZAR,
  PERMISO_ACADEMICO_ACTUALIZAR_ASISTENCIA,
} from '@/modules/auth/constants'
import { EstructuraAcademicaPage } from './pages/estructura-academica-page'
import { AsignacionesDocentesPage } from './pages/asignaciones-docentes-page'
import { AsistenciaDivisionPage } from './pages/asistencia-division-page'

export const academicoRoutes: RouteObject[] = [
  {
    // Estructura curricular: pide el `actualizar` sin tipo (dueño de la estructura), no
    // `.leer` — un docente que solo puede tomar asistencia no debería ni ver estas páginas.
    element: <PermisoRoute codigo={PERMISO_ACADEMICO_ACTUALIZAR} label="Académico · Actualizar" />,
    children: [
      {
        path: 'academico',
        children: [
          {
            index: true,
            element: <EstructuraAcademicaPage />,
          },
          {
            path: 'asignaciones',
            element: <AsignacionesDocentesPage />,
          },
        ],
      },
    ],
  },
  {
    // Separado del grupo de arriba: un docente entra acá con su permiso tipado, sin acceso a
    // la estructura curricular (ver nav-items.ts y auth/constants.py).
    element: (
      <PermisoRoute
        codigo={PERMISO_ACADEMICO_ACTUALIZAR_ASISTENCIA}
        label="Académico · Tomar asistencia"
      />
    ),
    children: [{ path: 'academico/asistencia', element: <AsistenciaDivisionPage /> }],
  },
]
