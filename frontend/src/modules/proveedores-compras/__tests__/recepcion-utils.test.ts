import { describe, expect, it } from 'vitest'
import { ordenSinPendientes, totalPendiente } from '@/modules/proveedores-compras/utils'
import type { LineaPendiente } from '@/modules/proveedores-compras/types'

function linea(overrides: Partial<LineaPendiente>): LineaPendiente {
  return {
    orden_compra_detalle_id: 'd1',
    producto_servicio_id: 'ps1',
    cantidad_pedida: '10.00',
    cantidad_recibida: '0.00',
    cantidad_pendiente: '10.00',
    ...overrides,
  }
}

describe('ordenSinPendientes', () => {
  it('es falso mientras falte algo', () => {
    expect(ordenSinPendientes([linea({ cantidad_pendiente: '6.00' })])).toBe(false)
  })

  it('es verdadero cuando todas las líneas están completas', () => {
    const completas = [
      linea({ orden_compra_detalle_id: 'd1', cantidad_pendiente: '0.00' }),
      linea({ orden_compra_detalle_id: 'd2', cantidad_pendiente: '0.00' }),
    ]

    expect(ordenSinPendientes(completas)).toBe(true)
  })

  it('basta con que una sola línea tenga pendiente', () => {
    const mixtas = [
      linea({ orden_compra_detalle_id: 'd1', cantidad_pendiente: '0.00' }),
      linea({ orden_compra_detalle_id: 'd2', cantidad_pendiente: '2.50' }),
    ]

    expect(ordenSinPendientes(mixtas)).toBe(false)
  })

  it('una orden sin líneas no cuenta como completa', () => {
    expect(ordenSinPendientes([])).toBe(false)
  })
})

describe('totalPendiente', () => {
  it('suma el pendiente de todas las líneas', () => {
    const lineas = [
      linea({ orden_compra_detalle_id: 'd1', cantidad_pendiente: '6.00' }),
      linea({ orden_compra_detalle_id: 'd2', cantidad_pendiente: '2.50' }),
    ]

    expect(totalPendiente(lineas)).toBe(8.5)
  })

  it('devuelve cero cuando no falta nada', () => {
    expect(totalPendiente([linea({ cantidad_pendiente: '0.00' })])).toBe(0)
  })

  it('devuelve cero sin líneas', () => {
    expect(totalPendiente([])).toBe(0)
  })
})
