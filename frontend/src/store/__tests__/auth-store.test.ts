import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setRolActivoRemoto } from '@/modules/auth/services/set-rol-activo'
import { permisosActivos, useAuthStore } from '@/store/auth-store'

vi.mock('@/modules/auth/services/set-rol-activo')

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
  perfiles: [
    { id: 'admin', codigo: 'admin', nombre: 'admin', descripcion: null, permisos: [permisoLeer] },
  ],
  rol_activo: 'admin',
}

const usuarioDosRoles = {
  id: 'u2',
  email: 'b@esseri.edu.ar',
  auth_provider: 'google',
  estado: 'activo',
  roles: ['docente', 'familia'],
  permisos: [],
  perfiles: [
    {
      id: 'docente',
      codigo: 'docente',
      nombre: 'docente',
      descripcion: null,
      permisos: [permisoLeer],
    },
    { id: 'familia', codigo: 'familia', nombre: 'familia', descripcion: null, permisos: [] },
  ],
  rol_activo: null,
}

beforeEach(() => {
  vi.mocked(setRolActivoRemoto).mockReset().mockResolvedValue({ detail: 'Rol activo actualizado' })
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

  it('confía en el rol_activo que devuelve el backend', () => {
    useAuthStore.getState().setUsuario(usuarioUnRol)

    expect(useAuthStore.getState().rolActivo).toBe('admin')
  })

  it('con rol_activo null (0 o 2+ roles), no elige ninguno (hay que preguntarle)', () => {
    useAuthStore.getState().setUsuario(usuarioDosRoles)

    expect(useAuthStore.getState().rolActivo).toBeNull()
  })

  it('setRolActivo avisa al backend y recién después cambia el rol activo y sus permisos', async () => {
    useAuthStore.getState().setUsuario(usuarioDosRoles)

    await useAuthStore.getState().setRolActivo('docente')

    expect(setRolActivoRemoto).toHaveBeenCalledWith('docente')
    expect(useAuthStore.getState().rolActivo).toBe('docente')
    expect(permisosActivos(useAuthStore.getState())).toEqual([permisoLeer])
  })

  it('si el backend rechaza el cambio, no toca el rol activo local', async () => {
    useAuthStore.getState().setUsuario(usuarioDosRoles)
    vi.mocked(setRolActivoRemoto).mockRejectedValueOnce(new Error('403'))

    await expect(useAuthStore.getState().setRolActivo('docente')).rejects.toThrow()

    expect(useAuthStore.getState().rolActivo).toBeNull()
  })

  it('permisosActivos devuelve lista vacía sin rol activo', () => {
    useAuthStore.getState().setUsuario(usuarioDosRoles)

    expect(permisosActivos(useAuthStore.getState())).toEqual([])
  })
})
