import { describe, expect, it } from 'vitest'
import {
  estadoVigencia,
  fechaMinimaNuevoPrecio,
  fechaSugeridaNuevoPrecio,
  hoyISO,
  preciosDeProveedor,
  proveedoresAsociables,
} from '@/modules/proveedores-compras/utils'
import type {
  PrecioProducto,
  Proveedor,
  ProveedorDeProducto,
} from '@/modules/proveedores-compras/types'

function proveedor(overrides: Partial<Proveedor>): Proveedor {
  return {
    id: 'prov-1',
    nombre: 'Papelera del Sur',
    categoria: null,
    telefono: null,
    email: null,
    estado: 'activo',
    created_at: '2026-08-29T10:00:00Z',
    updated_at: '2026-08-29T10:00:00Z',
    ...overrides,
  }
}

function precio(overrides: Partial<PrecioProducto>): PrecioProducto {
  return {
    id: 'precio-1',
    precio: '1500.00',
    vigencia_desde: '2026-01-01',
    vigencia_hasta: null,
    producto_servicio_id: 'prod-1',
    proveedor_id: 'prov-1',
    updated_at: '2026-01-01T10:00:00Z',
    ...overrides,
  }
}

function asociado(proveedorId: string): ProveedorDeProducto {
  return { proveedor_id: proveedorId, proveedor_nombre: 'x', precio_vigente: null }
}

const HOY = '2026-10-05'

describe('proveedoresAsociables', () => {
  const PAPELERA = proveedor({ id: 'prov-1', nombre: 'Papelera del Sur' })
  const ANDINA = proveedor({ id: 'prov-2', nombre: 'Distribuidora Andina' })
  const DE_BAJA = proveedor({ id: 'prov-3', nombre: 'Librería Central', estado: 'inactivo' })

  it('ofrece solo los activos, ordenados por nombre', () => {
    expect(proveedoresAsociables([PAPELERA, DE_BAJA, ANDINA], [])).toEqual([ANDINA, PAPELERA])
  })

  it('saca a los que ya están asociados al ítem', () => {
    expect(proveedoresAsociables([PAPELERA, ANDINA], [asociado('prov-1')])).toEqual([ANDINA])
  })
})

describe('preciosDeProveedor', () => {
  it('filtra por proveedor y ordena del más reciente al más viejo', () => {
    const viejo = precio({ id: 'a', vigencia_desde: '2026-01-01', vigencia_hasta: '2026-02-28' })
    const nuevo = precio({ id: 'b', vigencia_desde: '2026-03-01' })
    const ajeno = precio({ id: 'c', proveedor_id: 'prov-2' })

    expect(preciosDeProveedor([viejo, ajeno, nuevo], 'prov-1').map((p) => p.id)).toEqual(['b', 'a'])
  })
})

describe('estadoVigencia', () => {
  it('un precio abierto que ya empezó está vigente', () => {
    expect(estadoVigencia(precio({ vigencia_desde: '2026-03-01' }), HOY)).toBe('vigente')
  })

  it('el día de comienzo y el de cierre todavía cuentan como vigentes', () => {
    expect(estadoVigencia(precio({ vigencia_desde: HOY }), HOY)).toBe('vigente')
    expect(estadoVigencia(precio({ vigencia_desde: '2026-01-01', vigencia_hasta: HOY }), HOY)).toBe(
      'vigente',
    )
  })

  it('un precio cerrado antes de hoy es histórico', () => {
    expect(
      estadoVigencia(precio({ vigencia_desde: '2026-01-01', vigencia_hasta: '2026-02-28' }), HOY),
    ).toBe('historico')
  })

  it('un precio que empieza después de hoy es futuro aunque esté abierto', () => {
    expect(estadoVigencia(precio({ vigencia_desde: '2026-11-01' }), HOY)).toBe('futuro')
  })
})

describe('fechaMinimaNuevoPrecio', () => {
  it('sin precios previos no hay mínimo', () => {
    expect(fechaMinimaNuevoPrecio([])).toBeNull()
  })

  it('es el día siguiente al comienzo del último precio, sin importar el orden', () => {
    const precios = [
      precio({ vigencia_desde: '2026-03-01' }),
      precio({ vigencia_desde: '2026-01-01', vigencia_hasta: '2026-02-28' }),
    ]

    expect(fechaMinimaNuevoPrecio(precios)).toBe('2026-03-02')
    expect(fechaMinimaNuevoPrecio([...precios].reverse())).toBe('2026-03-02')
  })

  it('cruza fin de mes y fin de año', () => {
    expect(fechaMinimaNuevoPrecio([precio({ vigencia_desde: '2026-02-28' })])).toBe('2026-03-01')
    expect(fechaMinimaNuevoPrecio([precio({ vigencia_desde: '2026-12-31' })])).toBe('2027-01-01')
  })
})

describe('fechaSugeridaNuevoPrecio', () => {
  it('sugiere hoy cuando el último precio empezó antes', () => {
    expect(fechaSugeridaNuevoPrecio([precio({ vigencia_desde: '2026-03-01' })], HOY)).toBe(HOY)
    expect(fechaSugeridaNuevoPrecio([], HOY)).toBe(HOY)
  })

  it('si el último precio empieza hoy o después, sugiere el primer día que el backend acepta', () => {
    expect(fechaSugeridaNuevoPrecio([precio({ vigencia_desde: HOY })], HOY)).toBe('2026-10-06')
    expect(fechaSugeridaNuevoPrecio([precio({ vigencia_desde: '2026-11-01' })], HOY)).toBe(
      '2026-11-02',
    )
  })
})

describe('hoyISO', () => {
  it('usa la fecha local, no la UTC', () => {
    // 23:30 del 5/10 en hora local: en UTC-3 ya es 6/10, y `toISOString()` daría el día siguiente.
    expect(hoyISO(new Date(2026, 9, 5, 23, 30))).toBe('2026-10-05')
  })
})
