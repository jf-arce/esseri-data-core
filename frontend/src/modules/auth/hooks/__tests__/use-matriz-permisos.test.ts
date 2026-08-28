import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMatrizPermisos } from '@/modules/auth/hooks/use-matriz-permisos'
import { asignarPermisoARol } from '@/modules/auth/services/asignar-permiso-a-rol'
import { getPermisos } from '@/modules/auth/services/get-permisos'
import { getPermisosDeRol } from '@/modules/auth/services/get-permisos-de-rol'
import { getRoles } from '@/modules/auth/services/get-roles'
import { quitarPermisoARol } from '@/modules/auth/services/quitar-permiso-a-rol'
import type { Permiso, Rol } from '@/modules/auth/types'

vi.mock('@/modules/auth/services/get-roles')
vi.mock('@/modules/auth/services/get-permisos')
vi.mock('@/modules/auth/services/get-permisos-de-rol')
vi.mock('@/modules/auth/services/asignar-permiso-a-rol')
vi.mock('@/modules/auth/services/quitar-permiso-a-rol')

const mockedGetRoles = vi.mocked(getRoles)
const mockedGetPermisos = vi.mocked(getPermisos)
const mockedGetPermisosDeRol = vi.mocked(getPermisosDeRol)
const mockedAsignar = vi.mocked(asignarPermisoARol)
const mockedQuitar = vi.mocked(quitarPermisoARol)

const rolDocente: Rol = { id: 'rol-docente', nombre: 'docente', descripcion: null }
const rolFamilia: Rol = { id: 'rol-familia', nombre: 'familia', descripcion: null }

const permisoLeer: Permiso = {
  id: 'permiso-leer',
  codigo: 'academico.leer',
  modulo: 'Académico',
  accion: 'leer',
  tipo_informacion: null,
}
const permisoCrear: Permiso = {
  id: 'permiso-crear',
  codigo: 'academico.crear',
  modulo: 'Académico',
  accion: 'crear',
  tipo_informacion: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedGetRoles.mockResolvedValue([rolDocente, rolFamilia])
  mockedGetPermisos.mockResolvedValue([permisoLeer, permisoCrear])
  mockedGetPermisosDeRol.mockImplementation((rolId) =>
    Promise.resolve(rolId === rolDocente.id ? [permisoLeer] : []),
  )
  mockedAsignar.mockResolvedValue(undefined)
  mockedQuitar.mockResolvedValue(undefined)
})

describe('useMatrizPermisos', () => {
  it('carga la matriz inicial reflejando lo que ya tiene cada rol', async () => {
    const { result } = renderHook(() => useMatrizPermisos())

    await waitFor(() => expect(result.current.cargando).toBe(false))

    expect(result.current.estaMarcado(rolDocente.id, permisoLeer.id)).toBe(true)
    expect(result.current.estaMarcado(rolDocente.id, permisoCrear.id)).toBe(false)
    expect(result.current.estaMarcado(rolFamilia.id, permisoLeer.id)).toBe(false)
    expect(result.current.hayCambiosPendientes).toBe(false)
  })

  it('guardar solo emite las celdas que cambiaron, no toda la matriz', async () => {
    const { result } = renderHook(() => useMatrizPermisos())
    await waitFor(() => expect(result.current.cargando).toBe(false))

    // docente pierde "leer" (ya lo tenía) y gana "crear" (no lo tenía).
    act(() => result.current.toggle(rolDocente.id, permisoLeer.id))
    act(() => result.current.toggle(rolDocente.id, permisoCrear.id))
    expect(result.current.hayCambiosPendientes).toBe(true)

    await act(() => result.current.guardarCambios())

    expect(mockedQuitar).toHaveBeenCalledTimes(1)
    expect(mockedQuitar).toHaveBeenCalledWith(rolDocente.id, permisoLeer.id)
    expect(mockedAsignar).toHaveBeenCalledTimes(1)
    expect(mockedAsignar).toHaveBeenCalledWith(rolDocente.id, permisoCrear.id)
    // familia no cambió: ninguna llamada la involucra.
    expect(mockedQuitar).not.toHaveBeenCalledWith(rolFamilia.id, expect.anything())
    expect(mockedAsignar).not.toHaveBeenCalledWith(rolFamilia.id, expect.anything())
  })

  it('togglear una celda dos veces vuelve al estado original y no emite nada al guardar', async () => {
    const { result } = renderHook(() => useMatrizPermisos())
    await waitFor(() => expect(result.current.cargando).toBe(false))

    act(() => result.current.toggle(rolFamilia.id, permisoLeer.id))
    act(() => result.current.toggle(rolFamilia.id, permisoLeer.id))
    expect(result.current.hayCambiosPendientes).toBe(false)

    await act(() => result.current.guardarCambios())

    expect(mockedAsignar).not.toHaveBeenCalled()
    expect(mockedQuitar).not.toHaveBeenCalled()
  })

  it('descartar cambios vuelve la matriz al estado del servidor', async () => {
    const { result } = renderHook(() => useMatrizPermisos())
    await waitFor(() => expect(result.current.cargando).toBe(false))

    act(() => result.current.toggle(rolFamilia.id, permisoLeer.id))
    expect(result.current.estaMarcado(rolFamilia.id, permisoLeer.id)).toBe(true)

    act(() => result.current.descartarCambios())

    expect(result.current.estaMarcado(rolFamilia.id, permisoLeer.id)).toBe(false)
    expect(result.current.hayCambiosPendientes).toBe(false)
  })
})
