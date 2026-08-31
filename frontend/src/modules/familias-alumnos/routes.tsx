import type { RouteObject } from 'react-router'
import { FamiliaFormPage } from './pages/familia-form-page'
import { FamiliasPage } from './pages/familias-page'
import { FamiliaFichaPage } from './pages/familia-ficha-page'
import { AlumnoFormPage } from './pages/alumno-form-page'
import { AlumnoFichaPage } from './pages/alumno-ficha-page'
import { AlumnosPage } from './pages/alumnos-page'

export const familiasAlumnosRoutes: RouteObject[] = [
  {
    path: 'familias-alumnos',
    children: [
      {
        index: true,
        element: <FamiliasPage />,
      },
      {
        path: 'nueva-familia',
        element: <FamiliaFormPage />,
      },
      {
        path: 'familias/:familiaId',
        element: <FamiliaFichaPage />,
      },
      {
        path: 'familias/:familiaId/editar',
        element: <FamiliaFormPage />,
      },
      {
        path: 'alumnos',
        element: <AlumnosPage />,
      },
      {
        path: 'alumnos/nuevo',
        element: <AlumnoFormPage />,
      },
      {
        path: 'alumnos/:alumnoId',
        element: <AlumnoFichaPage />,
      },
      {
        path: 'alumnos/:alumnoId/editar',
        element: <AlumnoFormPage />,
      },
    ],
  },
]
