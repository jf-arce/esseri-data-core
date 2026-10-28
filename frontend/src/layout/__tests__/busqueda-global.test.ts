import { describe, expect, it, vi } from 'vitest'
import {
  ACCIONES,
  FUENTES,
  accionesVisibles,
  buscarEnFuentes,
  fuentesVisibles,
  type FuenteBusqueda,
} from '@/layout/busqueda-global'
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

describe('fuentesVisibles', () => {
  const clavesCon = (...codigos: string[]) =>
    fuentesVisibles(codigos.map(permiso)).map((fuente) => fuente.clave)

  it('sin permisos no hay fuentes', () => {
    expect(clavesCon()).toEqual([])
  })

  it('cada fuente se habilita con el .leer de su módulo', () => {
    expect(clavesCon('familias_alumnos.leer')).toEqual(['alumnos', 'familias'])
    expect(clavesCon('facturacion.leer')).toEqual(['facturas', 'deudas'])
    expect(clavesCon('proveedores_compras.leer')).toEqual(['ordenes'])
  })

  it('las claves son únicas', () => {
    const claves = FUENTES.map((fuente) => fuente.clave)
    expect(new Set(claves).size).toBe(claves.length)
  })
})

describe('buscarEnFuentes', () => {
  const contexto = { obtenerUsuarios: async () => [], puedeEditarUsuarios: false }
  const fuente = (clave: string, buscar: FuenteBusqueda['buscar']): FuenteBusqueda => ({
    ...FUENTES[0],
    clave,
    buscar,
  })

  it('una fuente que falla no oculta las demás', async () => {
    const fuentes = [
      fuente('rota', async () => {
        throw new Error('sin permiso')
      }),
      fuente('ok', async () => [{ id: '1', etiqueta: 'A', detalle: 'B', ruta: '/a' }]),
    ]

    const resultado = await buscarEnFuentes(fuentes, 'ab', new AbortController().signal, contexto)

    expect(resultado).toEqual({
      rota: [],
      ok: [{ id: '1', etiqueta: 'A', detalle: 'B', ruta: '/a' }],
    })
  })

  it('pasa la consulta y la señal a cada fuente', async () => {
    const buscar = vi.fn(async () => [])
    const controller = new AbortController()

    await buscarEnFuentes([fuente('x', buscar)], 'paz', controller.signal, contexto)

    expect(buscar).toHaveBeenCalledWith('paz', controller.signal, contexto)
  })
})
