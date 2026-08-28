import type { RouteObject } from 'react-router'
import { PermisoRoute } from '@/router/permiso-route'
import { PERMISO_AUTENTICACION_LEER } from '@/modules/auth/constants'
import { LoginPage } from './pages/login-page'
import { ConfiguracionAccesoPage } from './pages/configuracion-acceso-page'

export const authRoutes: RouteObject[] = [{ path: 'login', element: <LoginPage /> }]

// A diferencia de `authRoutes` (login, público), estas rutas van dentro del shell protegido
// (`ProtectedRoute` + `AppLayout` en `router/index.tsx`), por eso se exportan separadas.
export const authPrivateRoutes: RouteObject[] = [
  {
    element: <PermisoRoute codigo={PERMISO_AUTENTICACION_LEER} label="Autenticación · Leer" />,
    children: [{ path: 'configuracion/acceso', element: <ConfiguracionAccesoPage /> }],
  },
]
