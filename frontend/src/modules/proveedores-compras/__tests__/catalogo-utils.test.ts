import { describe, expect, it } from 'vitest'
import {
  categoriasDeProductos,
  filtrarYOrdenarProductos,
} from '@/modules/proveedores-compras/utils'
import type { ProductoServicio } from '@/modules/proveedores-compras/types'

function producto(overrides: Partial<ProductoServicio>): ProductoServicio {
  return {
    id: 'p1',
    nombre: 'Resma A4',
    categoria: 'Librería',
    unidad: 'unidad',
    tipo: 'producto',
    activo: true,
    created_at: '2026-08-29T10:00:00Z',
    updated_at: '2026-08-29T10:00:00Z',
    ...overrides,
  }
}

const RESMA = producto({ id: 'p1', nombre: 'Resma A4', categoria: 'Librería' })
const ALCOHOL = producto({ id: 'p2', nombre: 'Alcohol en gel', categoria: 'Limpieza' })
const MANTENIMIENTO = producto({
  id: 'p3',
  nombre: 'Mantenimiento de aire',
  categoria: null,
  tipo: 'servicio',
  unidad: 'hora',
})
const DISCONTINUADO = producto({
  id: 'p4',
  nombre: 'Zapatilla eléctrica',
  categoria: 'Ferretería',
  activo: false,
})

const TODOS = [RESMA, ALCOHOL, MANTENIMIENTO, DISCONTINUADO]

const SIN_FILTROS = {
  busqueda: '',
  categorias: [] as string[],
  tipo: '' as const,
  soloActivos: true,
  orden: 'nombre-asc' as const,
}

describe('filtrarYOrdenarProductos', () => {
  it('esconde los inactivos por defecto', () => {
    const resultado = filtrarYOrdenarProductos(TODOS, SIN_FILTROS)

    expect(resultado.map((p) => p.id)).toEqual(['p2', 'p3', 'p1'])
  })

  it('muestra los inactivos cuando se lo piden', () => {
    const resultado = filtrarYOrdenarProductos(TODOS, { ...SIN_FILTROS, soloActivos: false })

    expect(resultado.map((p) => p.id)).toContain('p4')
  })

  it('ordena por nombre alfabéticamente', () => {
    const resultado = filtrarYOrdenarProductos(TODOS, { ...SIN_FILTROS, soloActivos: false })

    expect(resultado.map((p) => p.nombre)).toEqual([
      'Alcohol en gel',
      'Mantenimiento de aire',
      'Resma A4',
      'Zapatilla eléctrica',
    ])
  })

  it('filtra por tipo', () => {
    const resultado = filtrarYOrdenarProductos(TODOS, { ...SIN_FILTROS, tipo: 'servicio' })

    expect(resultado.map((p) => p.id)).toEqual(['p3'])
  })

  it('encuentra un ítem con tilde buscando sin tilde', () => {
    const resultado = filtrarYOrdenarProductos(TODOS, {
      ...SIN_FILTROS,
      soloActivos: false,
      busqueda: 'electrica',
    })

    expect(resultado.map((p) => p.id)).toEqual(['p4'])
  })

  it('busca también por categoría', () => {
    const resultado = filtrarYOrdenarProductos(TODOS, { ...SIN_FILTROS, busqueda: 'limpieza' })

    expect(resultado.map((p) => p.id)).toEqual(['p2'])
  })

  it('no rompe con la categoría en null', () => {
    const resultado = filtrarYOrdenarProductos(TODOS, { ...SIN_FILTROS, busqueda: 'mantenimiento' })

    expect(resultado.map((p) => p.id)).toEqual(['p3'])
  })

  it('el filtro de inactivos y el de tipo se combinan', () => {
    const resultado = filtrarYOrdenarProductos(TODOS, {
      ...SIN_FILTROS,
      soloActivos: true,
      tipo: 'producto',
    })

    expect(resultado.map((p) => p.id)).toEqual(['p2', 'p1'])
  })

  it('filtra por varias categorías a la vez', () => {
    const resultado = filtrarYOrdenarProductos(TODOS, {
      ...SIN_FILTROS,
      categorias: ['Librería', 'Limpieza'],
    })

    expect(resultado.map((p) => p.id)).toEqual(['p2', 'p1'])
  })

  it('no muta el arreglo original', () => {
    const original = [...TODOS]

    filtrarYOrdenarProductos(TODOS, { ...SIN_FILTROS, orden: 'nombre-desc' })

    expect(TODOS).toEqual(original)
  })
})

describe('categoriasDeProductos', () => {
  it('devuelve las categorías únicas y ordenadas, sin los nulos', () => {
    expect(categoriasDeProductos(TODOS)).toEqual(['Ferretería', 'Librería', 'Limpieza'])
  })
})
