import { describe, expect, it } from 'vitest'
import {
  categoriasDisponibles,
  filtrarYOrdenarProveedores,
} from '@/modules/proveedores-compras/utils'
import type { Proveedor } from '@/modules/proveedores-compras/types'

function proveedor(overrides: Partial<Proveedor>): Proveedor {
  return {
    id: 'p1',
    nombre: 'Librería Central',
    categoria: 'Librería',
    telefono: null,
    email: null,
    estado: 'activo',
    created_at: '2026-08-29T10:00:00Z',
    updated_at: '2026-08-29T10:00:00Z',
    ...overrides,
  }
}

const LIBRERIA = proveedor({ id: 'p1', nombre: 'Librería Central', categoria: 'Librería' })
const ALIMENTOS = proveedor({
  id: 'p2',
  nombre: 'Alimentos del Río',
  categoria: 'Comedor',
  email: 'ventas@alimentosdelrio.com.ar',
})
const ZAPATERIA = proveedor({
  id: 'p3',
  nombre: 'Zapatería Sur',
  categoria: null,
  estado: 'inactivo',
})

const TODOS = [LIBRERIA, ALIMENTOS, ZAPATERIA]

const SIN_FILTROS = {
  busqueda: '',
  categorias: [] as string[],
  estado: '' as const,
  orden: 'nombre-asc' as const,
}

describe('filtrarYOrdenarProveedores', () => {
  it('ordena por nombre alfabéticamente por defecto', () => {
    const resultado = filtrarYOrdenarProveedores(TODOS, SIN_FILTROS)

    expect(resultado.map((p) => p.nombre)).toEqual([
      'Alimentos del Río',
      'Librería Central',
      'Zapatería Sur',
    ])
  })

  it('encuentra un proveedor con tilde buscando sin tilde', () => {
    const resultado = filtrarYOrdenarProveedores(TODOS, { ...SIN_FILTROS, busqueda: 'libreria' })

    expect(resultado.map((p) => p.id)).toEqual(['p1'])
  })

  it('busca también por categoría y por email', () => {
    expect(
      filtrarYOrdenarProveedores(TODOS, { ...SIN_FILTROS, busqueda: 'comedor' }).map((p) => p.id),
    ).toEqual(['p2'])
    expect(
      filtrarYOrdenarProveedores(TODOS, { ...SIN_FILTROS, busqueda: 'alimentosdelrio' }).map(
        (p) => p.id,
      ),
    ).toEqual(['p2'])
  })

  it('filtra por estado', () => {
    const resultado = filtrarYOrdenarProveedores(TODOS, { ...SIN_FILTROS, estado: 'inactivo' })

    expect(resultado.map((p) => p.id)).toEqual(['p3'])
  })

  it('filtra por varias categorías a la vez', () => {
    const resultado = filtrarYOrdenarProveedores(TODOS, {
      ...SIN_FILTROS,
      categorias: ['Librería', 'Comedor'],
    })

    expect(resultado.map((p) => p.id)).toEqual(['p2', 'p1'])
  })

  it('combina búsqueda y estado en vez de aplicar solo el último', () => {
    const resultado = filtrarYOrdenarProveedores(TODOS, {
      ...SIN_FILTROS,
      busqueda: 'a',
      estado: 'activo',
    })

    expect(resultado.map((p) => p.id)).toEqual(['p2', 'p1'])
  })

  it('ordena descendente cuando se lo piden', () => {
    const resultado = filtrarYOrdenarProveedores(TODOS, { ...SIN_FILTROS, orden: 'nombre-desc' })

    expect(resultado.map((p) => p.nombre)).toEqual([
      'Zapatería Sur',
      'Librería Central',
      'Alimentos del Río',
    ])
  })

  it('al ordenar por categoría deja los sin categoría primero y desempata por nombre', () => {
    const resultado = filtrarYOrdenarProveedores(TODOS, { ...SIN_FILTROS, orden: 'categoria-asc' })

    expect(resultado.map((p) => p.categoria)).toEqual([null, 'Comedor', 'Librería'])
  })

  it('no muta el arreglo original', () => {
    const original = [...TODOS]

    filtrarYOrdenarProveedores(TODOS, { ...SIN_FILTROS, orden: 'nombre-desc' })

    expect(TODOS).toEqual(original)
  })
})

describe('categoriasDisponibles', () => {
  it('devuelve las categorías únicas y ordenadas, sin los nulos', () => {
    expect(
      categoriasDisponibles([...TODOS, proveedor({ id: 'p4', categoria: 'Librería' })]),
    ).toEqual(['Comedor', 'Librería'])
  })
})
