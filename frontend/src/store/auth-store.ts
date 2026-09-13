import { create } from 'zustand'
import { setRolActivoRemoto } from '@/modules/auth/services/set-rol-activo'
import type { Permiso, UsuarioActual } from '@/modules/auth/types'

type SessionStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated'

interface AuthState {
  usuario: UsuarioActual | null
  status: SessionStatus
  /** Rol con el que la sesión está autorizando de verdad — lo fija el backend (RF-30), esto
   * solo refleja `usuario.rol_activo`. `null` sin rol elegido todavía: hay que preguntarle. */
  rolActivo: string | null
  setUsuario: (usuario: UsuarioActual) => void
  setRolActivo: (rol: string) => Promise<void>
  clearSesion: () => void
  setLoading: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  usuario: null,
  status: 'idle',
  rolActivo: null,
  setUsuario: (usuario) => {
    set({ usuario, status: 'authenticated', rolActivo: usuario.rol_activo })
  },
  setRolActivo: async (rol) => {
    // Si el backend rechaza el cambio (rol que no pertenece a la cuenta), no tocamos el
    // estado local: el llamador decide cómo mostrar el error.
    await setRolActivoRemoto(rol)
    set({ rolActivo: rol })
  },
  clearSesion: () => set({ usuario: null, status: 'unauthenticated', rolActivo: null }),
  setLoading: () => set({ status: 'loading' }),
}))

// Referencia estable: un selector de zustand que devuelve `[] ` (un array literal nuevo en
// cada llamada) rompe `useSyncExternalStore` con "Maximum update depth exceeded" apenas algún
// componente lo usa sin rol activo — cada render ve un snapshot "distinto" aunque el contenido
// sea el mismo vacío.
const SIN_PERMISOS: Permiso[] = []

/** Permisos del rol activo (no la suma de `usuario.permisos`): lo que efectivamente filtra el
 * sidebar y las rutas. Lista vacía sin rol activo todavía elegido. */
export function permisosActivos(state: AuthState): Permiso[] {
  return (
    state.usuario?.perfiles.find((perfil) => perfil.nombre === state.rolActivo)?.permisos ??
    SIN_PERMISOS
  )
}
