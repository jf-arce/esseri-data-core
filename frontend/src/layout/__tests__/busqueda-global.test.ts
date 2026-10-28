import { describe, expect, it } from 'vitest'
import { ACCIONES, accionesVisibles } from '@/layout/busqueda-global'
import type { Permiso } from '@/modules/auth/types'

function permiso(codigo: string): Permiso {
  return {
    id: codigo,
    codigo,
    modulo: codigo.split('.')[0],
    accion: codigo.split('.')[1],
    tipo_informacion: null,
  }
}

const etiquetasCon = (...codigos: string[]) =>
  accionesVisibles(codigos.map(permiso)).map((accion) => accion.etiqueta)

describe('accionesVisibles', () => {
  it('sin permisos no ofrece ninguna alta', () => {
    expect(etiquetasCon()).toEqual([])
  })

  it('exige el .leer de la ruta además del .crear', () => {
    expect(etiquetasCon('proveedores_compras.crear')).toEqual([])
    expect(etiquetasCon('proveedores_compras.crear', 'proveedores_compras.leer')).toEqual([
      'Nuevo proveedor',
      'Nueva solicitud de compra',
      'Nueva orden de compra',
      'Nuevo producto o servicio',
    ])
  })

  it('la asignación docente pide academico.crear y academico.actualizar', () => {
    expect(etiquetasCon('academico.leer', 'academico.actualizar')).not.toContain(
      'Nueva asignación docente',
    )
    expect(etiquetasCon('academico.leer', 'academico.crear')).not.toContain(
      'Nueva asignación docente',
    )
    expect(etiquetasCon('academico.leer', 'academico.crear', 'academico.actualizar')).toContain(
      'Nueva asignación docente',
    )
  })

  it('facturación ofrece regla, penalidad y generación con facturacion.crear', () => {
    expect(etiquetasCon('facturacion.crear', 'facturacion.leer')).toEqual([
      'Nueva factura',
      'Nueva regla de facturación',
      'Nueva regla de penalidad',
      'Generar facturación',
    ])
  })

  it('no repite rutas', () => {
    const rutas = ACCIONES.map((accion) => accion.ruta)
    expect(new Set(rutas).size).toBe(rutas.length)
  })
})
