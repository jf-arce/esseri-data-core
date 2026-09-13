import { create } from 'zustand'
import type { Permiso, UsuarioActual } from '@/modules/auth/types'

type SessionStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated'

const CLAVE_ROL_ACTIVO = 'esseri.rol-activo'

// sessionStorage (no localStorage): el rol activo sobrevive a un F5 dentro de la misma pestaña,
// pero un login nuevo (otra pestaña, o cerrar sesión y volver a entrar) vuelve a preguntar —
// no queremos que quede "pegado" el rol de otro usuario en la misma máquina. Puede tirar en un
// modo privado o con storage bloqueado: nunca debe romper el login por eso.
function leerRolGuardado(usuarioId: string): string | null {
  try {
    const guardado = sessionStorage.getItem(CLAVE_ROL_ACTIVO)
    if (!guardado) return null
    const { usuarioId: id, rol } = JSON.parse(guardado) as { usuarioId: string; rol: string }
    return id === usuarioId ? rol : null
  } catch {
    return null
  }
}

function guardarRolActivo(usuarioId: string, rol: string | null): void {
  try {
    if (rol === null) {
      sessionStorage.removeItem(CLAVE_ROL_ACTIVO)
    } else {
      sessionStorage.setItem(CLAVE_ROL_ACTIVO, JSON.stringify({ usuarioId, rol }))
    }
  } catch {
    // Sin persistencia (modo privado, storage bloqueado): el rol activo sigue funcionando en
    // memoria para esta sesión de pestaña, solo no sobrevive a un F5.
  }
}

interface AuthState {
  usuario: UsuarioActual | null
  status: SessionStatus
  /** Rol con el que el usuario decidió entrar (pantalla "¿Cómo querés entrar?" o "Cambiar
   * vista"). `null` con más de un rol disponible: todavía no eligió, hay que preguntarle. */
  rolActivo: string | null
  setUsuario: (usuario: UsuarioActual) => void
  setRolActivo: (rol: string) => void
  clearSesion: () => void
  setLoading: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  usuario: null,
  status: 'idle',
  rolActivo: null,
  setUsuario: (usuario) => {
    const nombresDeRoles = usuario.perfiles.map((perfil) => perfil.nombre)
    const guardado = leerRolGuardado(usuario.id)
    const rolActivo =
      nombresDeRoles.length === 1
        ? nombresDeRoles[0]
        : guardado && nombresDeRoles.includes(guardado)
          ? guardado
          : null
    set({ usuario, status: 'authenticated', rolActivo })
  },
  setRolActivo: (rol) =>
    set((state) => {
      if (state.usuario) guardarRolActivo(state.usuario.id, rol)
      return { rolActivo: rol }
    }),
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
