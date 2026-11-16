import { describe, expect, it } from 'vitest'
import type { SolicitudCompra } from '@/modules/proveedores-compras/types'
import {
  alternarSolicitudEnLineas,
  cantidadEntera,
  lineaOrdenVacia,
} from '@/modules/proveedores-compras/utils'

function solicitud(overrides: Partial<SolicitudCompra>): SolicitudCompra {
  return {
    id: 's1',
    articulo: 'Resmas A4',
    producto_servicio_id: 'prod-1',
    cantidad: 3,
    area_solicitante: 'Compras',
    area_solicitante_id: 'area-1',
    estado: 'aprobada',
    fecha: '2026-08-20',
    usuario_id: 'u1',
    solicitante_nombre: 'Ana',
    updated_at: '2026-08-20T10:00:00Z',
    ...overrides,
  }
}

describe('cantidadEntera', () => {
  it('acepta enteros positivos', () => {
    expect(cantidadEntera('1')).toBe(1)
    expect(cantidadEntera('25')).toBe(25)
  })

  it('rechaza vacío, cero, negativos y decimales', () => {
    expect(cantidadEntera('')).toBeNull()
    expect(cantidadEntera('0')).toBeNull()
    expect(cantidadEntera('-3')).toBeNull()
    expect(cantidadEntera('2.5')).toBeNull()
    expect(cantidadEntera('abc')).toBeNull()
  })
})

describe('alternarSolicitudEnLineas', () => {
  it('carga la cantidad de la solicitud al tildarla', () => {
    const primera = solicitud({ id: 's1', cantidad: 3 })

    const lineas = alternarSolicitudEnLineas([lineaOrdenVacia()], primera, true, [primera])

    expect(lineas).toEqual([
      { productoId: 'prod-1', cantidad: '3', solicitudIds: ['s1'], editada: false },
    ])
  })

  it('suma varias solicitudes del mismo ítem en una sola línea', () => {
    const primera = solicitud({ id: 's1', cantidad: 3 })
    const segunda = solicitud({ id: 's2', cantidad: 4 })

    const conPrimera = alternarSolicitudEnLineas([lineaOrdenVacia()], primera, true, [
      primera,
      segunda,
    ])
    const conSegunda = alternarSolicitudEnLineas(conPrimera, segunda, true, [primera, segunda])

    expect(conSegunda).toHaveLength(1)
    expect(conSegunda[0]).toMatchObject({
      productoId: 'prod-1',
      cantidad: '7',
      solicitudIds: ['s1', 's2'],
    })
  })

  it('al destildar una solicitud descuenta solo su cantidad', () => {
    const primera = solicitud({ id: 's1', cantidad: 3 })
    const segunda = solicitud({ id: 's2', cantidad: 4 })
    const conAmbas = alternarSolicitudEnLineas(
      alternarSolicitudEnLineas([lineaOrdenVacia()], primera, true, [primera, segunda]),
      segunda,
      true,
      [primera, segunda],
    )

    const sinPrimera = alternarSolicitudEnLineas(conAmbas, primera, false, [primera, segunda])

    expect(sinPrimera[0]).toMatchObject({ cantidad: '4', solicitudIds: ['s2'] })
  })

  it('respeta la cantidad editada a mano y le suma el aporte nuevo', () => {
    const manual = { productoId: 'prod-1', cantidad: '10', solicitudIds: [], editada: true }
    const nueva = solicitud({ id: 's1', cantidad: 3 })

    const conSolicitud = alternarSolicitudEnLineas([manual], nueva, true, [nueva])

    expect(conSolicitud[0]).toMatchObject({ cantidad: '13', editada: true })

    const sinSolicitud = alternarSolicitudEnLineas(conSolicitud, nueva, false, [nueva])
    expect(sinSolicitud[0]).toMatchObject({ cantidad: '13', editada: true })
  })

  it('no toca el detalle si la solicitud no tiene ítem de catálogo', () => {
    const lineas = [lineaOrdenVacia()]
    const textoLibre = solicitud({ id: 's9', producto_servicio_id: null })

    expect(alternarSolicitudEnLineas(lineas, textoLibre, true, [textoLibre])).toBe(lineas)
  })

  it('reutiliza la línea vacía en vez de agregar otra', () => {
    const primera = solicitud({ id: 's1' })

    const lineas = alternarSolicitudEnLineas([lineaOrdenVacia()], primera, true, [primera])

    expect(lineas).toHaveLength(1)
  })

  it('deja una línea vacía cuando se destilda la última solicitud', () => {
    const primera = solicitud({ id: 's1' })
    const conSolicitud = alternarSolicitudEnLineas([lineaOrdenVacia()], primera, true, [primera])

    const resultado = alternarSolicitudEnLineas(conSolicitud, primera, false, [primera])

    expect(resultado).toEqual([lineaOrdenVacia()])
  })
})
