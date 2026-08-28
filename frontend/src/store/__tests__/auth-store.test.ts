import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '@/store/auth-store'

const usuario = {
  id: 'u1',
  email: 'a@esseri.edu.ar',
  auth_provider: 'google',
  estado: 'activo',
  roles: ['admin'],
  permisos: [],
}

beforeEach(() => {
  useAuthStore.setState({ usuario: null, status: 'idle' })
})

describe('useAuthStore', () => {
  it('arranca en idle sin usuario', () => {
    expect(useAuthStore.getState()).toMatchObject({ usuario: null, status: 'idle' })
  })

  it('setUsuario guarda el usuario y pasa a authenticated', () => {
    useAuthStore.getState().setUsuario(usuario)

    expect(useAuthStore.getState()).toMatchObject({ usuario, status: 'authenticated' })
  })

  it('clearSesion limpia el usuario y pasa a unauthenticated', () => {
    useAuthStore.getState().setUsuario(usuario)
    useAuthStore.getState().clearSesion()

    expect(useAuthStore.getState()).toMatchObject({ usuario: null, status: 'unauthenticated' })
  })

  it('setLoading pasa a loading sin tocar el usuario', () => {
    useAuthStore.getState().setUsuario(usuario)
    useAuthStore.getState().setLoading()

    expect(useAuthStore.getState()).toMatchObject({ usuario, status: 'loading' })
  })
})
