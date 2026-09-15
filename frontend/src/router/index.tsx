import { useRoutes } from 'react-router'
import { AppLayout } from '@/layout/app-layout'
import { PortalLayout } from '@/layout/portal-layout'
import { ElegirPerfilPage } from '@/pages/elegir-perfil-page'
import { PortalDocentePage } from '@/pages/portal-docente-page'
import { PortalDocenteAsistenciaPage } from '@/pages/portal-docente-asistencia-page'
import { ProtectedRoute } from '@/router/protected-route'
import { RolActivoRoute } from '@/router/rol-activo-route'
import { VistaRoute } from '@/router/vista-route'
import { InicioRoute } from '@/router/inicio-route'
import { authPrivateRoutes, authRoutes } from '@/modules/auth/routes'
import { familiasAlumnosRoutes } from '@/modules/familias-alumnos/routes'
import { academicoRoutes } from '@/modules/academico/routes'
import { inscripcionesRoutes } from '@/modules/inscripciones/routes'
import { facturacionRoutes } from '@/modules/facturacion/routes'
import { proveedoresComprasRoutes } from '@/modules/proveedores-compras/routes'
import { workflowsRoutes } from '@/modules/workflows/routes'
import { auditoriaRoutes } from '@/modules/auditoria/routes'
import { panelAdminRoutes } from '@/modules/panel-admin/routes'
import { iaSugerenciasFamiliaRoutes, iaSugerenciasRoutes } from '@/modules/ia-sugerencias/routes'

const moduleRoutes = [
  ...authPrivateRoutes,
  ...familiasAlumnosRoutes,
  ...academicoRoutes,
  ...inscripcionesRoutes,
  ...facturacionRoutes,
  ...proveedoresComprasRoutes,
  ...workflowsRoutes,
  ...auditoriaRoutes,
  ...panelAdminRoutes,
  ...iaSugerenciasRoutes,
]

export function AppRouter() {
  return useRoutes([
    ...authRoutes,
    {
      element: <ProtectedRoute />,
      children: [
        // Fuera del shell (sin sidebar): con sesión pero sin rol activo todavía elegido,
        // `RolActivoRoute` manda acá antes de mostrar nada del panel.
        { path: '/elegir-perfil', element: <ElegirPerfilPage /> },
        {
          element: <RolActivoRoute />,
          children: [
            // Tres vistas exclusivas entre sí (§8 DESIGN.md): Consola para los roles de
            // gestión, Portal Docente y Portal Familia — `VistaRoute` redirige a cada rol
            // activo a la suya, así que ninguna muestra algo de otro rol ni por deep link.
            // Portal Docente (RF-04: tomar asistencia) y Portal Familia (justificación de
            // inasistencias) ya tienen su primer flujo real, cada uno con sus propias rutas
            // anidadas.
            {
              element: <VistaRoute vista="consola" />,
              children: [
                {
                  element: <AppLayout />,
                  children: [{ index: true, element: <InicioRoute /> }, ...moduleRoutes],
                },
              ],
            },
            {
              element: <VistaRoute vista="docente" />,
              children: [
                {
                  element: <PortalLayout />,
                  children: [
                    { path: 'docente', element: <PortalDocentePage /> },
                    {
                      path: 'docente/asistencia/:divisionId',
                      element: <PortalDocenteAsistenciaPage />,
                    },
                  ],
                },
              ],
            },
            {
              element: <VistaRoute vista="familia" />,
              children: [
                {
                  element: <PortalLayout />,
                  children: iaSugerenciasFamiliaRoutes,
                },
              ],
            },
          ],
        },
      ],
    },
  ])
}
