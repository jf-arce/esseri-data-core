import type { RouteObject } from 'react-router'
import { PermisoRoute } from '@/router/permiso-route'
import {
  PERMISO_FAMILIAS_ALUMNOS_ACTUALIZAR,
  PERMISO_FAMILIAS_ALUMNOS_CREAR,
  PERMISO_FAMILIAS_ALUMNOS_LEER,
} from '@/modules/auth/constants'
import { FamiliaFormPage } from './pages/familia-form-page'
import { FamiliasPage } from './pages/familias-page'
import { FamiliaFichaPage } from './pages/familia-ficha-page'
import { AlumnoFormPage } from './pages/alumno-form-page'
import { AlumnoFichaPage } from './pages/alumno-ficha-page'
import { AlumnosPage } from './pages/alumnos-page'

export const familiasAlumnosRoutes: RouteObject[] = [
  {
    element: (
      <PermisoRoute codigo={PERMISO_FAMILIAS_ALUMNOS_LEER} label="Familias y Alumnos · Leer" />
    ),
    children: [
      {
        path: 'familias-alumnos',
        children: [
          {
            index: true,
            element: <FamiliasPage />,
          },
          {
            path: 'familias/:familiaId',
            element: <FamiliaFichaPage />,
          },
          {
            path: 'alumnos',
            element: <AlumnosPage />,
          },
          {
            path: 'alumnos/:alumnoId',
            element: <AlumnoFichaPage />,
          },
          {
            element: (
              <PermisoRoute
                codigo={PERMISO_FAMILIAS_ALUMNOS_CREAR}
                label="Familias y Alumnos · Crear"
              />
            ),
            children: [
              {
                path: 'nueva-familia',
                element: <FamiliaFormPage />,
              },
              {
                path: 'alumnos/nuevo',
                element: <AlumnoFormPage />,
              },
            ],
          },
          {
            element: (
              <PermisoRoute
                codigo={PERMISO_FAMILIAS_ALUMNOS_ACTUALIZAR}
                label="Familias y Alumnos · Actualizar"
              />
            ),
            children: [
              {
                path: 'familias/:familiaId/editar',
                element: <FamiliaFormPage />,
              },
              {
                path: 'alumnos/:alumnoId/editar',
                element: <AlumnoFormPage />,
              },
            ],
          },
        ],
      },
    ],
  },
]
