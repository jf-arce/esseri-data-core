import { useEffect } from 'react'
import { getMe } from '@/modules/auth/services/get-me'
import { useAuthStore } from '@/store/auth-store'

/**
 * GET /auth/me es la fuente de verdad de sesión al cargar la app: si hay una cookie
 * httpOnly válida, la devuelve con los roles; si no, 401. Se corre una sola vez al
 * montar la app, antes de decidir si mostrar rutas protegidas o mandar a /login.
 */
export function useBootstrapSesion() {
  const status = useAuthStore((state) => state.status)
  const setUsuario = useAuthStore((state) => state.setUsuario)
  const clearSesion = useAuthStore((state) => state.clearSesion)
  const setLoading = useAuthStore((state) => state.setLoading)

  useEffect(() => {
    setLoading()
    getMe()
      .then(setUsuario)
      .catch(() => clearSesion())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return status
}
