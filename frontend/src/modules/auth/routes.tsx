import type { RouteObject } from 'react-router'
import { Navigate } from 'react-router'
import { PermisoRoute } from '@/router/permiso-route'
import { PERMISO_AUTENTICACION_LEER } from '@/modules/auth/constants'
import { LoginPage } from './pages/login-page'
import { ConfiguracionAccesoPage } from './pages/configuracion-acceso-page'
import { UsuariosPage } from './pages/usuarios-page'
import { RolesPage } from './pages/roles-page'
import { PermisosPage } from './pages/permisos-page'
import { MatrizPermisosPage } from './pages/matriz-permisos-page'

export const authRoutes: RouteObject[] = [{ path: 'login', element: <LoginPage /> }]

// A diferencia de `authRoutes` (login, público), estas rutas van dentro del shell protegido
// (`ProtectedRoute` + `AppLayout` en `router/index.tsx`), por eso se exportan separadas.
//
// Cada tab de la pantalla de acceso es una ruta propia (deep-link, botón atrás, recarga):
// `ConfiguracionAccesoPage` es solo el layout de la sección (encabezado + tabs + Outlet).
export const authPrivateRoutes: RouteObject[] = [
  {
    element: <PermisoRoute codigo={PERMISO_AUTENTICACION_LEER} label="Autenticación · Leer" />,
    children: [
      {
        path: 'configuracion/acceso',
        element: <ConfiguracionAccesoPage />,
        children: [
          { index: true, element: <Navigate to="usuarios" replace /> },
          { path: 'usuarios', element: <UsuariosPage /> },
          { path: 'roles', element: <RolesPage /> },
          { path: 'permisos', element: <PermisosPage /> },
          { path: 'matriz', element: <MatrizPermisosPage /> },
        ],
      },
    ],
  },
]
