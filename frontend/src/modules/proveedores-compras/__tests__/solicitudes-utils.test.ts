import { describe, expect, it } from 'vitest'
import {
  FILTROS_SOLICITUDES_VACIOS,
  descripcionSolicitud,
  filtrarYOrdenarSolicitudes,
  formatearFechaDia,
  hayFiltrosSolicitudes,
  solicitantesDisponibles,
} from '@/modules/proveedores-compras/utils'
import type { SolicitudCompra } from '@/modules/proveedores-compras/types'

function solicitud(overrides: Partial<SolicitudCompra>): SolicitudCompra {
  return {
    id: 's1',
    articulo: 'Resmas A4',
    producto_servicio_id: null,
    cantidad: 10,
    area_solicitante: 'Secretaría',
    area_solicitante_id: 'a1',
    estado: 'pendiente',
    fecha: '2026-08-20',
    usuario_id: 'u1',
    solicitante_nombre: 'Ana Pérez',
    updated_at: '2026-08-20T10:00:00Z',
    ...overrides,
  }
}

const PENDIENTE = solicitud({
  id: 's1',
  articulo: 'Resmas A4',
  fecha: '2026-08-20',
  cantidad: 10,
})
const APROBADA = solicitud({
  id: 's2',
  articulo: 'Cartuchos de tinta',
  estado: 'aprobada',
  fecha: '2026-08-25',
  cantidad: 3,
  area_solicitante: 'Dirección',
  area_solicitante_id: 'a2',
  usuario_id: 'u2',
  solicitante_nombre: 'Bruno Díaz',
})
const RECHAZADA = solicitud({
  id: 's3',
  articulo: 'Sillas de oficina',
  estado: 'rechazada',
  fecha: '2026-07-01',
  cantidad: 25,
  area_solicitante: null,
  area_solicitante_id: null,
  usuario_id: 'u3',
  solicitante_nombre: 'Carla Gómez',
})

const TODAS = [PENDIENTE, APROBADA, RECHAZADA]

const SIN_FILTROS = FILTROS_SOLICITUDES_VACIOS
const ORDEN_FECHA_DESC = 'fecha-desc' as const

describe('filtrarYOrdenarSolicitudes', () => {
  it('ordena de más reciente a más antigua por defecto', () => {
    const resultado = filtrarYOrdenarSolicitudes(TODAS, SIN_FILTROS, ORDEN_FECHA_DESC)

    expect(resultado.map((s) => s.id)).toEqual(['s2', 's1', 's3'])
  })

  it('ordena de más antigua a más reciente cuando se lo piden', () => {
    const resultado = filtrarYOrdenarSolicitudes(TODAS, SIN_FILTROS, 'fecha-asc')

    expect(resultado.map((s) => s.id)).toEqual(['s3', 's1', 's2'])
  })

  it('ordena por cantidad descendente', () => {
    const resultado = filtrarYOrdenarSolicitudes(TODAS, SIN_FILTROS, 'cantidad-desc')

    expect(resultado.map((s) => s.cantidad)).toEqual([25, 10, 3])
  })

  it('filtra por estado', () => {
    const resultado = filtrarYOrdenarSolicitudes(
      TODAS,
      { ...SIN_FILTROS, estado: 'pendiente' },
      ORDEN_FECHA_DESC,
    )

    expect(resultado.map((s) => s.id)).toEqual(['s1'])
  })

  it('filtra por área', () => {
    const resultado = filtrarYOrdenarSolicitudes(
      TODAS,
      { ...SIN_FILTROS, areaId: 'a2' },
      ORDEN_FECHA_DESC,
    )

    expect(resultado.map((s) => s.id)).toEqual(['s2'])
  })

  it('filtra por solicitante', () => {
    const resultado = filtrarYOrdenarSolicitudes(
      TODAS,
      { ...SIN_FILTROS, solicitante: 'Bruno Díaz' },
      ORDEN_FECHA_DESC,
    )

    expect(resultado.map((s) => s.id)).toEqual(['s2'])
  })

  it('filtra por rango de fechas, con ambos extremos incluidos', () => {
    const resultado = filtrarYOrdenarSolicitudes(
      TODAS,
      { ...SIN_FILTROS, desde: '2026-08-20', hasta: '2026-08-25' },
      'fecha-asc',
    )

    expect(resultado.map((s) => s.id)).toEqual(['s1', 's2'])
  })

  it('filtra por cantidad mínima y máxima', () => {
    const resultado = filtrarYOrdenarSolicitudes(
      TODAS,
      { ...SIN_FILTROS, cantidadMin: '5', cantidadMax: '20' },
      'fecha-asc',
    )

    expect(resultado.map((s) => s.id)).toEqual(['s1'])
  })

  it('ignora los rangos de cantidad vacíos', () => {
    const resultado = filtrarYOrdenarSolicitudes(TODAS, SIN_FILTROS, 'fecha-asc')

    expect(resultado).toHaveLength(3)
  })

  it('busca por artículo sin depender de las tildes', () => {
    const resultado = filtrarYOrdenarSolicitudes(
      TODAS,
      { ...SIN_FILTROS, busqueda: 'cartuchos' },
      ORDEN_FECHA_DESC,
    )

    expect(resultado.map((s) => s.id)).toEqual(['s2'])
  })

  it('busca también por área solicitante', () => {
    const resultado = filtrarYOrdenarSolicitudes(
      TODAS,
      { ...SIN_FILTROS, busqueda: 'direccion' },
      ORDEN_FECHA_DESC,
    )

    expect(resultado.map((s) => s.id)).toEqual(['s2'])
  })

  it('busca también por solicitante', () => {
    const resultado = filtrarYOrdenarSolicitudes(
      TODAS,
      { ...SIN_FILTROS, busqueda: 'perez' },
      ORDEN_FECHA_DESC,
    )

    expect(resultado.map((s) => s.id)).toEqual(['s1'])
  })

  it('no rompe con el área en null', () => {
    const resultado = filtrarYOrdenarSolicitudes(
      [RECHAZADA],
      { ...SIN_FILTROS, busqueda: 'sillas' },
      ORDEN_FECHA_DESC,
    )

    expect(resultado.map((s) => s.id)).toEqual(['s3'])
  })

  it('combina búsqueda y estado', () => {
    const resultado = filtrarYOrdenarSolicitudes(
      TODAS,
      { ...SIN_FILTROS, busqueda: 'a', estado: 'aprobada' },
      ORDEN_FECHA_DESC,
    )

    expect(resultado.map((s) => s.id)).toEqual(['s2'])
  })

  it('no muta el arreglo original', () => {
    const original = [...TODAS]

    filtrarYOrdenarSolicitudes(TODAS, SIN_FILTROS, 'cantidad-desc')

    expect(TODAS).toEqual(original)
  })
})

describe('hayFiltrosSolicitudes', () => {
  it('no cuenta el orden ni los filtros vacíos', () => {
    expect(hayFiltrosSolicitudes(FILTROS_SOLICITUDES_VACIOS)).toBe(false)
  })

  it('detecta cualquier filtro cargado', () => {
    expect(hayFiltrosSolicitudes({ ...FILTROS_SOLICITUDES_VACIOS, areaId: 'a1' })).toBe(true)
    expect(hayFiltrosSolicitudes({ ...FILTROS_SOLICITUDES_VACIOS, cantidadMin: '5' })).toBe(true)
  })
})

describe('solicitantesDisponibles', () => {
  it('devuelve los nombres sin repetir, ordenados alfabéticamente', () => {
    const repetida = solicitud({ id: 's4', solicitante_nombre: 'Ana Pérez' })

    expect(solicitantesDisponibles([PENDIENTE, APROBADA, repetida])).toEqual([
      'Ana Pérez',
      'Bruno Díaz',
    ])
  })
})

describe('formatearFechaDia', () => {
  it('muestra la fecha en orden día/mes/año', () => {
    expect(formatearFechaDia('2026-08-20')).toBe('20/08/2026')
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
