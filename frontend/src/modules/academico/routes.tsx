import type { RouteObject } from 'react-router'
import { EstructuraAcademicaPage } from './pages/estructura-academica-page'

export const academicoRoutes: RouteObject[] = [
  {
    path: 'academico',
    children: [
      {
        index: true,
        element: <EstructuraAcademicaPage />,
      },
    ],
  },
]
