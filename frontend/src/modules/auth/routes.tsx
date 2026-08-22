import type { RouteObject } from 'react-router'
import { LoginPage } from './pages/login-page'

export const authRoutes: RouteObject[] = [{ path: 'login', element: <LoginPage /> }]
