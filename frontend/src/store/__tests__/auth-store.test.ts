import { beforeEach, describe, expect, it } from 'vitest'
import { permisosActivos, useAuthStore } from '@/store/auth-store'

const permisoLeer = {
  id: 'p1',
  codigo: 'academico.leer',
  modulo: 'Académico',
  accion: 'leer',
  tipo_informacion: null,
}

const usuarioUnRol = {
  id: 'u1',
  email: 'a@esseri.edu.ar',
  auth_provider: 'google',
  estado: 'activo',
  roles: ['admin'],
  permisos: [permisoLeer],
  perfiles: [{ id: 'admin', nombre: 'admin', descripcion: null, permisos: [permisoLeer] }],
}

const usuarioDosRoles = {
  id: 'u2',
  email: 'b@esseri.edu.ar',
  auth_provider: 'google',
  estado: 'activo',
  roles: ['docente', 'familia'],
  permisos: [],
  perfiles: [
    { id: 'docente', nombre: 'docente', descripcion: null, permisos: [permisoLeer] },
    { id: 'familia', nombre: 'familia', descripcion: null, permisos: [] },
  ],
}

beforeEach(() => {
  sessionStorage.clear()
  useAuthStore.setState({ usuario: null, status: 'idle', rolActivo: null })
})

describe('useAuthStore', () => {
  it('arranca en idle sin usuario', () => {
    expect(useAuthStore.getState()).toMatchObject({ usuario: null, status: 'idle' })
  })

  it('setUsuario guarda el usuario y pasa a authenticated', () => {
    useAuthStore.getState().setUsuario(usuarioUnRol)

    expect(useAuthStore.getState()).toMatchObject({
      usuario: usuarioUnRol,
      status: 'authenticated',
    })
  })

  it('clearSesion limpia el usuario, el rol activo y pasa a unauthenticated', () => {
    useAuthStore.getState().setUsuario(usuarioUnRol)
    useAuthStore.getState().clearSesion()

    expect(useAuthStore.getState()).toMatchObject({
      usuario: null,
      status: 'unauthenticated',
      rolActivo: null,
    })
  })

  it('setLoading pasa a loading sin tocar el usuario', () => {
    useAuthStore.getState().setUsuario(usuarioUnRol)
    useAuthStore.getState().setLoading()

    expect(useAuthStore.getState()).toMatchObject({ usuario: usuarioUnRol, status: 'loading' })
  })

  it('con un solo rol, lo fija como rol activo automáticamente', () => {
    useAuthStore.getState().setUsuario(usuarioUnRol)

    expect(useAuthStore.getState().rolActivo).toBe('admin')
  })

  it('con más de un rol y nada guardado, no elige ninguno (hay que preguntarle)', () => {
    useAuthStore.getState().setUsuario(usuarioDosRoles)

    expect(useAuthStore.getState().rolActivo).toBeNull()
  })

  it('setRolActivo cambia el rol activo y sus permisos', () => {
    useAuthStore.getState().setUsuario(usuarioDosRoles)

    useAuthStore.getState().setRolActivo('docente')

    expect(useAuthStore.getState().rolActivo).toBe('docente')
    expect(permisosActivos(useAuthStore.getState())).toEqual([permisoLeer])
  })

  it('un rol activo guardado para el mismo usuario se recupera al volver a loguear', () => {
    useAuthStore.getState().setUsuario(usuarioDosRoles)
    useAuthStore.getState().setRolActivo('familia')
    useAuthStore.setState({ usuario: null, status: 'unauthenticated', rolActivo: null })

    useAuthStore.getState().setUsuario(usuarioDosRoles)

    expect(useAuthStore.getState().rolActivo).toBe('familia')
  })

  it('permisosActivos devuelve lista vacía sin rol activo', () => {
    useAuthStore.getState().setUsuario(usuarioDosRoles)

    expect(permisosActivos(useAuthStore.getState())).toEqual([])
  })
})
