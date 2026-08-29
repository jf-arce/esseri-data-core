import { describe, expect, it } from 'vitest'
import { filtrarYOrdenarOrdenes, totalUnidadesPedidas } from '@/modules/proveedores-compras/utils'
import type { OrdenCompra } from '@/modules/proveedores-compras/types'

function orden(overrides: Partial<OrdenCompra>): OrdenCompra {
  return {
    id: 'o1',
    fecha: '2026-08-20',
    estado: 'emitida',
    proveedor_id: 'prov1',
    updated_at: '2026-08-20T10:00:00Z',
    detalles: [{ id: 'd1', producto_servicio_id: 'ps1', cantidad_pedida: '10.00' }],
    solicitud_ids: ['s1'],
    ...overrides,
  }
}

const EMITIDA = orden({ id: 'o1', fecha: '2026-08-20', proveedor_id: 'prov1' })
const RECIBIDA = orden({
  id: 'o2',
  fecha: '2026-08-25',
  estado: 'recibida',
  proveedor_id: 'prov2',
})
const CANCELADA = orden({
  id: 'o3',
  fecha: '2026-07-10',
  estado: 'cancelada',
  proveedor_id: 'prov1',
})

const TODAS = [EMITIDA, RECIBIDA, CANCELADA]

const NOMBRES = {
  prov1: 'Papelera del Sur',
  prov2: 'Librería Central',
}

const SIN_FILTROS = {
  busqueda: '',
  estado: '' as const,
  orden: 'fecha-desc' as const,
}

describe('filtrarYOrdenarOrdenes', () => {
  it('ordena de más reciente a más antigua por defecto', () => {
    const resultado = filtrarYOrdenarOrdenes(TODAS, SIN_FILTROS, NOMBRES)

    expect(resultado.map((o) => o.id)).toEqual(['o2', 'o1', 'o3'])
  })

  it('ordena de más antigua a más reciente cuando se lo piden', () => {
    const resultado = filtrarYOrdenarOrdenes(TODAS, { ...SIN_FILTROS, orden: 'fecha-asc' }, NOMBRES)

    expect(resultado.map((o) => o.id)).toEqual(['o3', 'o1', 'o2'])
  })

  it('filtra por estado', () => {
    const resultado = filtrarYOrdenarOrdenes(TODAS, { ...SIN_FILTROS, estado: 'emitida' }, NOMBRES)

    expect(resultado.map((o) => o.id)).toEqual(['o1'])
  })

  it('busca por nombre de proveedor, que no viene en la orden', () => {
    const resultado = filtrarYOrdenarOrdenes(
      TODAS,
      { ...SIN_FILTROS, busqueda: 'papelera' },
      NOMBRES,
    )

    expect(resultado.map((o) => o.id)).toEqual(['o1', 'o3'])
  })

  it('encuentra el proveedor buscando sin tildes', () => {
    const resultado = filtrarYOrdenarOrdenes(
      TODAS,
      { ...SIN_FILTROS, busqueda: 'libreria' },
      NOMBRES,
    )

    expect(resultado.map((o) => o.id)).toEqual(['o2'])
  })

  it('no rompe si falta el mapa de proveedores', () => {
    const resultado = filtrarYOrdenarOrdenes(TODAS, { ...SIN_FILTROS, busqueda: 'papelera' })

    expect(resultado).toEqual([])
  })

  it('combina búsqueda y estado', () => {
    const resultado = filtrarYOrdenarOrdenes(
      TODAS,
      { ...SIN_FILTROS, busqueda: 'papelera', estado: 'cancelada' },
      NOMBRES,
    )

    expect(resultado.map((o) => o.id)).toEqual(['o3'])
  })

  it('no muta el arreglo original', () => {
    const original = [...TODAS]

    filtrarYOrdenarOrdenes(TODAS, { ...SIN_FILTROS, orden: 'fecha-asc' }, NOMBRES)

    expect(TODAS).toEqual(original)
  })
})

describe('totalUnidadesPedidas', () => {
  it('suma las cantidades de todas las líneas', () => {
    const conVariasLineas = orden({
      detalles: [
        { id: 'd1', producto_servicio_id: 'ps1', cantidad_pedida: '10.00' },
        { id: 'd2', producto_servicio_id: 'ps2', cantidad_pedida: '5.50' },
      ],
    })

    expect(totalUnidadesPedidas(conVariasLineas)).toBe(15.5)
  })

  it('devuelve cero cuando la orden no tiene detalle', () => {
    expect(totalUnidadesPedidas(orden({ detalles: [] }))).toBe(0)
  })
})
