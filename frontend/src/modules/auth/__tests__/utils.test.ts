import { describe, expect, it } from 'vitest'
import {
  filtrarPermisosDeMatriz,
  filtrarYOrdenarPermisos,
  filtrarYOrdenarRoles,
  filtrarYOrdenarUsuarios,
  nombreDeUsuario,
} from '@/modules/auth/utils'
import type { Permiso, Rol, UsuarioConRoles } from '@/modules/auth/types'

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

function rol(overrides: Partial<Rol>): Rol {
  return { id: 'r1', nombre: 'Docente', descripcion: null, ...overrides }
}

describe('filtrarYOrdenarRoles', () => {
  const roles = [
    rol({ id: 'r1', nombre: 'Docente', descripcion: 'Asistencia y calificaciones' }),
    rol({ id: 'r2', nombre: 'Administración', descripcion: 'Operación diaria' }),
    rol({ id: 'r3', nombre: 'Dirección', descripcion: null }),
  ]

  it('filtra por nombre', () => {
    const resultado = filtrarYOrdenarRoles(roles, { busqueda: 'docente', orden: 'nombre-asc' })
    expect(resultado.map((r) => r.id)).toEqual(['r1'])
  })

  it('filtra por descripción', () => {
    const resultado = filtrarYOrdenarRoles(roles, { busqueda: 'diaria', orden: 'nombre-asc' })
    expect(resultado.map((r) => r.id)).toEqual(['r2'])
  })

  it('ordena por nombre ascendente y descendente', () => {
    // Administración < Dirección < Docente
    const asc = filtrarYOrdenarRoles(roles, { busqueda: '', orden: 'nombre-asc' })
    expect(asc.map((r) => r.id)).toEqual(['r2', 'r3', 'r1'])

    const desc = filtrarYOrdenarRoles(roles, { busqueda: '', orden: 'nombre-desc' })
    expect(desc.map((r) => r.id)).toEqual(['r1', 'r3', 'r2'])
  })
})

function permiso(overrides: Partial<Permiso>): Permiso {
  return {
    id: 'p1',
    codigo: 'familias.ver',
    modulo: 'Familias y Alumnos',
    accion: 'Ver',
    tipo_informacion: null,
    ...overrides,
  }
}

describe('filtrarYOrdenarPermisos', () => {
  const permisos = [
    permiso({ id: 'p1', modulo: 'Familias y Alumnos', accion: 'Ver' }),
    permiso({ id: 'p2', modulo: 'Facturación', accion: 'Registrar pago', tipo_informacion: 'Económica' }),
    permiso({ id: 'p3', modulo: 'Académico', accion: 'Editar' }),
  ]

  it('filtra por texto contra módulo, acción y tipo de información', () => {
    const resultado = filtrarYOrdenarPermisos(permisos, { busqueda: 'económica', modulos: [], orden: 'modulo-asc' })
    expect(resultado.map((p) => p.id)).toEqual(['p2'])
  })

  it('filtra por módulo (multiselección)', () => {
    const resultado = filtrarYOrdenarPermisos(permisos, {
      busqueda: '',
      modulos: ['Académico', 'Facturación'],
      orden: 'modulo-asc',
    })
    expect(resultado.map((p) => p.id).sort()).toEqual(['p2', 'p3'])
  })

  it('ordena por módulo y por acción', () => {
    const porModulo = filtrarYOrdenarPermisos(permisos, { busqueda: '', modulos: [], orden: 'modulo-asc' })
    expect(porModulo.map((p) => p.id)).toEqual(['p3', 'p2', 'p1'])

    const porAccion = filtrarYOrdenarPermisos(permisos, { busqueda: '', modulos: [], orden: 'accion-asc' })
    expect(porAccion.map((p) => p.id)).toEqual(['p3', 'p2', 'p1'])
  })
})

describe('filtrarPermisosDeMatriz', () => {
  const permisos = [
    permiso({ id: 'p1', modulo: 'Familias y Alumnos', accion: 'Ver' }),
    permiso({ id: 'p2', modulo: 'Facturación', accion: 'Registrar pago' }),
  ]

  it('filtra por texto de módulo·acción', () => {
    const resultado = filtrarPermisosDeMatriz(permisos, { busqueda: 'registrar', modulos: [] })
    expect(resultado.map((p) => p.id)).toEqual(['p2'])
  })

  it('filtra por módulo', () => {
    const resultado = filtrarPermisosDeMatriz(permisos, { busqueda: '', modulos: ['Familias y Alumnos'] })
    expect(resultado.map((p) => p.id)).toEqual(['p1'])
  })
})
