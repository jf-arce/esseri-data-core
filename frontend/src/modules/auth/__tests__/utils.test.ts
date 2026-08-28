import { describe, expect, it } from 'vitest'
import { filtrarYOrdenarUsuarios, nombreDeUsuario } from '@/modules/auth/utils'
import type { UsuarioConRoles } from '@/modules/auth/types'

const ROL_DOCENTE = { id: 'r1', nombre: 'Docente', descripcion: null }
const ROL_FAMILIA = { id: 'r2', nombre: 'Familia', descripcion: null }

function usuario(overrides: Partial<UsuarioConRoles>): UsuarioConRoles {
  return {
    id: 'u1',
    email: 'julieta.amaya@esseri.edu.ar',
    estado: 'activo',
    auth_provider: 'google',
    ultimo_acceso: '2026-08-24T07:55:00Z',
    roles: [],
    ...overrides,
  }
}

describe('nombreDeUsuario', () => {
  it('arma "Apellido, Nombre" a partir de la parte local del mail', () => {
    expect(nombreDeUsuario('mariana.cufre@esseri.edu.ar')).toBe('Cufre, Mariana')
  })

  it('devuelve el mail completo si no hay separador', () => {
    expect(nombreDeUsuario('admin@esseri.edu.ar')).toBe('Admin')
  })
})

describe('filtrarYOrdenarUsuarios', () => {
  const usuarios = [
    usuario({ id: 'u1', email: 'mariana.cufre@esseri.edu.ar', estado: 'activo', roles: [ROL_DOCENTE] }),
    usuario({
      id: 'u2',
      email: 'julieta.amaya@esseri.edu.ar',
      estado: 'inactivo',
      roles: [ROL_FAMILIA],
      ultimo_acceso: '2026-01-01T00:00:00Z',
    }),
    usuario({ id: 'u3', email: 'pablo.lezcano@esseri.edu.ar', estado: 'activo', roles: [] }),
  ]

  it('filtra por texto de búsqueda contra el nombre derivado y el mail', () => {
    const resultado = filtrarYOrdenarUsuarios(usuarios, {
      busqueda: 'cufre',
      estado: 'todos',
      roles: [],
      orden: 'nombre-asc',
    })
    expect(resultado.map((u) => u.id)).toEqual(['u1'])
  })

  it('filtra por estado', () => {
    const resultado = filtrarYOrdenarUsuarios(usuarios, {
      busqueda: '',
      estado: 'inactivo',
      roles: [],
      orden: 'nombre-asc',
    })
    expect(resultado.map((u) => u.id)).toEqual(['u2'])
  })

  it('filtra por rol (coincide con al menos uno de los seleccionados)', () => {
    const resultado = filtrarYOrdenarUsuarios(usuarios, {
      busqueda: '',
      estado: 'todos',
      roles: [ROL_FAMILIA.id],
      orden: 'nombre-asc',
    })
    expect(resultado.map((u) => u.id)).toEqual(['u2'])
  })

  it('ordena por nombre ascendente', () => {
    const resultado = filtrarYOrdenarUsuarios(usuarios, {
      busqueda: '',
      estado: 'todos',
      roles: [],
      orden: 'nombre-asc',
    })
    // Amaya, Julieta < Cufre, Mariana < Lezcano, Pablo
    expect(resultado.map((u) => u.id)).toEqual(['u2', 'u1', 'u3'])
  })

  it('ordena por último acceso más reciente primero', () => {
    const resultado = filtrarYOrdenarUsuarios(usuarios, {
      busqueda: '',
      estado: 'todos',
      roles: [],
      orden: 'acceso-reciente',
    })
    expect(resultado[0].id).toBe('u1')
    expect(resultado[resultado.length - 1].id).toBe('u2')
  })
})
