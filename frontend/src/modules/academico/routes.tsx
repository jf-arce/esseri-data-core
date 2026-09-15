import type { RouteObject } from 'react-router'
import { PermisoRoute } from '@/router/permiso-route'
import {
  PERMISO_ACADEMICO_ACTUALIZAR_ASISTENCIA,
  PERMISO_ACADEMICO_EXPORTAR,
  PERMISO_ACADEMICO_LEER,
} from '@/modules/auth/constants'
import { EstructuraAcademicaPage } from './pages/estructura-academica-page'
import { AsignacionesDocentesPage } from './pages/asignaciones-docentes-page'
import { AsistenciaDivisionPage } from './pages/asistencia-division-page'
import { ExportarAsistenciasPage } from './pages/exportar-asistencias-page'
import { HistorialAsistenciaPage } from './pages/historial-asistencia-page'
import { JustificacionesPage } from './pages/justificaciones-page'

export const academicoRoutes: RouteObject[] = [
  {
    // Estructura curricular: pide el `.leer` para ENTRAR (dirección la mira sin operarla, ver
    // nav-items.ts) — las páginas ocultan sus propios botones de crear/editar/eliminar sin el
    // `actualizar` de escritura (`tienePermiso(permisos, PERMISO_ACADEMICO_ACTUALIZAR)`, mismo
    // patrón que `asistencia-division-page.tsx`). Un docente también tiene `academico.leer`,
    // pero nunca llega acá: `VistaRoute` lo manda a su propio Portal antes de esta ruta.
    element: <PermisoRoute codigo={PERMISO_ACADEMICO_LEER} label="Académico · Leer" />,
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
          { path: 'justificaciones', element: <JustificacionesPage /> },
          {
            // RF-05/RF-06: mismo permiso de lectura que el resto de este grupo. El scoping por
            // división de un docente (`verificar_acceso_a_division`) lo resuelve el backend en
            // cada request, no esta ruta.
            path: 'historial-asistencia',
            element: <HistorialAsistenciaPage />,
          },
        ],
      },
    ],
  },
  {
    // Separado del grupo de arriba: cualquier rol de consola que también toma asistencia
    // (secretaría, coordinación académica, administrador del sistema) entra acá con su permiso
    // tipado. El docente toma asistencia desde su propio Portal, no desde este árbol de consola.
    element: (
      <PermisoRoute
        codigo={PERMISO_ACADEMICO_ACTUALIZAR_ASISTENCIA}
        label="Académico · Tomar asistencia"
      />
    ),
    children: [{ path: 'academico/asistencia', element: <AsistenciaDivisionPage /> }],
  },
  {
    // RF-37: permiso propio, sin tipo -- lo tiene dirección (visión completa, sin
    // `actualizar` de ningún tipo), no un docente ni secretaría/coordinación (que operan el
    // día a día pero no exportan reportes institucionales).
    element: <PermisoRoute codigo={PERMISO_ACADEMICO_EXPORTAR} label="Académico · Exportar" />,
    children: [{ path: 'academico/exportar-asistencias', element: <ExportarAsistenciasPage /> }],
  },
]
