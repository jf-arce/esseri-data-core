import { useEffect } from 'react'
import { Navigate, Outlet, useNavigate } from 'react-router'
import { consumirDestino } from '@/modules/auth/utils'
import { useAuthStore } from '@/store/auth-store'

// Con sesión iniciada pero sin rol activo (cuenta con más de un rol, todavía sin elegir):
// manda a la pantalla "¿Cómo querés entrar?" en vez de dejar pasar a un shell sin rol —
// evita el bug original de mostrar Panel de Dirección y Panel Administrativo a la vez.
export function RolActivoRoute() {
  const rolActivo = useAuthStore((state) => state.rolActivo)
  const navigate = useNavigate()
  const tieneRol = rolActivo !== null

  // Se monta una vez por inicio de sesión (login local, Google o "elegir perfil"): si la
  // persona venía de un link a una pantalla, la lleva ahí. Va en un efecto y no en el render
  // porque consumir borra el destino y StrictMode renderiza dos veces.
  useEffect(() => {
    if (!tieneRol) return
    const destino = consumirDestino()
    if (destino !== null) navigate(destino, { replace: true })
  }, [tieneRol, navigate])

  if (!tieneRol) {
    return <Navigate to="/elegir-perfil" replace />
  }

  return <Outlet />
}
