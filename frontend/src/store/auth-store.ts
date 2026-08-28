import { create } from 'zustand'
import type { UsuarioActual } from '@/modules/auth/types'

type SessionStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated'

interface AuthState {
  usuario: UsuarioActual | null
  status: SessionStatus
  setUsuario: (usuario: UsuarioActual) => void
  clearSesion: () => void
  setLoading: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  usuario: null,
  status: 'idle',
  setUsuario: (usuario) => set({ usuario, status: 'authenticated' }),
  clearSesion: () => set({ usuario: null, status: 'unauthenticated' }),
  setLoading: () => set({ status: 'loading' }),
}))
