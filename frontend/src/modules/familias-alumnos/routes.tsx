import type { RouteObject } from 'react-router'
import { FamiliaFormPage } from './pages/familia-form-page'

export const familiasAlumnosRoutes: RouteObject[] = [
  {
    path: 'familias-alumnos',
    children: [
      {
        path: 'nueva-familia',
        element: <FamiliaFormPage />,
      },
      {
        path: 'familias/:familiaId/editar',
        element: <FamiliaFormPage />,
      },
    ],
  },
]
