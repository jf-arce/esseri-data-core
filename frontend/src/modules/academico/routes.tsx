import type { RouteObject } from 'react-router'
import { EstructuraAcademicaPage } from './pages/estructura-academica-page'
import { AsignacionesDocentesPage } from './pages/asignaciones-docentes-page'
import { AsistenciaDivisionPage } from './pages/asistencia-division-page'

export const academicoRoutes: RouteObject[] = [
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
      {
        path: 'asistencia',
        element: <AsistenciaDivisionPage />,
      },
    ],
  },
]
