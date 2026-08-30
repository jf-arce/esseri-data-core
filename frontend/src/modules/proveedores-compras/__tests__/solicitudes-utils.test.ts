import { describe, expect, it } from 'vitest'
import {
  descripcionSolicitud,
  filtrarYOrdenarSolicitudes,
} from '@/modules/proveedores-compras/utils'
import type { SolicitudCompra } from '@/modules/proveedores-compras/types'

function solicitud(overrides: Partial<SolicitudCompra>): SolicitudCompra {
  return {
    id: 's1',
    articulo: 'Resmas A4',
    producto_servicio_id: null,
    cantidad: 10,
    area_solicitante: 'Secretaría',
    estado: 'pendiente',
    fecha: '2026-08-20',
    usuario_id: 'u1',
    updated_at: '2026-08-20T10:00:00Z',
    ...overrides,
  }
}

const PENDIENTE = solicitud({ id: 's1', articulo: 'Resmas A4', fecha: '2026-08-20', cantidad: 10 })
const APROBADA = solicitud({
  id: 's2',
  articulo: 'Cartuchos de tinta',
  estado: 'aprobada',
  fecha: '2026-08-25',
  cantidad: 3,
  area_solicitante: 'Dirección',
})
const RECHAZADA = solicitud({
  id: 's3',
  articulo: 'Sillas de oficina',
  estado: 'rechazada',
  fecha: '2026-07-01',
  cantidad: 25,
  area_solicitante: null,
})

const TODAS = [PENDIENTE, APROBADA, RECHAZADA]

const SIN_FILTROS = {
  busqueda: '',
  estado: '' as const,
  orden: 'fecha-desc' as const,
}

describe('filtrarYOrdenarSolicitudes', () => {
  it('ordena de más reciente a más antigua por defecto', () => {
    const resultado = filtrarYOrdenarSolicitudes(TODAS, SIN_FILTROS)

    expect(resultado.map((s) => s.id)).toEqual(['s2', 's1', 's3'])
  })

  it('ordena de más antigua a más reciente cuando se lo piden', () => {
    const resultado = filtrarYOrdenarSolicitudes(TODAS, { ...SIN_FILTROS, orden: 'fecha-asc' })

    expect(resultado.map((s) => s.id)).toEqual(['s3', 's1', 's2'])
  })

  it('ordena por cantidad descendente', () => {
    const resultado = filtrarYOrdenarSolicitudes(TODAS, { ...SIN_FILTROS, orden: 'cantidad-desc' })

    expect(resultado.map((s) => s.cantidad)).toEqual([25, 10, 3])
  })

  it('filtra por estado', () => {
    const resultado = filtrarYOrdenarSolicitudes(TODAS, { ...SIN_FILTROS, estado: 'pendiente' })

    expect(resultado.map((s) => s.id)).toEqual(['s1'])
  })

  it('busca por artículo sin depender de las tildes', () => {
    const resultado = filtrarYOrdenarSolicitudes(TODAS, { ...SIN_FILTROS, busqueda: 'cartuchos' })

    expect(resultado.map((s) => s.id)).toEqual(['s2'])
  })

  it('busca también por área solicitante', () => {
    const resultado = filtrarYOrdenarSolicitudes(TODAS, { ...SIN_FILTROS, busqueda: 'direccion' })

    expect(resultado.map((s) => s.id)).toEqual(['s2'])
  })

  it('no rompe con el área en null', () => {
    const resultado = filtrarYOrdenarSolicitudes([RECHAZADA], {
      ...SIN_FILTROS,
      busqueda: 'sillas',
    })

    expect(resultado.map((s) => s.id)).toEqual(['s3'])
  })

  it('combina búsqueda y estado', () => {
    const resultado = filtrarYOrdenarSolicitudes(TODAS, {
      ...SIN_FILTROS,
      busqueda: 'a',
      estado: 'aprobada',
    })

    expect(resultado.map((s) => s.id)).toEqual(['s2'])
  })

  it('no muta el arreglo original', () => {
    const original = [...TODAS]

    filtrarYOrdenarSolicitudes(TODAS, { ...SIN_FILTROS, orden: 'cantidad-desc' })

    expect(TODAS).toEqual(original)
  })
})

describe('descripcionSolicitud', () => {
  it('usa el artículo cuando el pedido es de texto libre', () => {
    expect(descripcionSolicitud(PENDIENTE)).toBe('Resmas A4')
  })

  it('cae a una etiqueta explícita cuando el pedido vino por catálogo', () => {
    const deCatalogo = solicitud({ articulo: null, producto_servicio_id: 'ps1' })

    expect(descripcionSolicitud(deCatalogo)).toBe('Ítem de catálogo')
  })

  it('devuelve un guion cuando no hay ninguno de los dos', () => {
    const rota = solicitud({ articulo: null, producto_servicio_id: null })

    expect(descripcionSolicitud(rota)).toBe('—')
  })
})
