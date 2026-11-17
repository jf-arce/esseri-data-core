import { describe, expect, it } from 'vitest'
import { EVENTO_FACTURA, reglaDe } from '@/modules/workflows/__tests__/fabricas'
import type { ConteoEstados, ResumenRegla, TipoEvento } from '@/modules/workflows/types'
import {
  agruparMapa,
  moduloDeEvento,
  reglasQueRequierenAtencion,
  textoVariacion,
  tiempoRelativo,
  variacionPorcentual,
} from '@/modules/workflows/utils-mapa'

const evento = (id: string, nombre: string): TipoEvento => ({
  id,
  nombre,
  descripcion: null,
  campos: [],
})

const conteo = (total: number): ConteoEstados => ({
  exitoso: total,
  fallido: 0,
  pendiente: 0,
  rechazado: 0,
  total,
})

describe('moduloDeEvento', () => {
  it('sale del prefijo del nombre y cae en "Otros" si no se conoce', () => {
    expect(moduloDeEvento('factura.vencida')).toBe('Facturación')
    expect(moduloDeEvento('inasistencia.justificada')).toBe('Asistencia')
    expect(moduloDeEvento('solicitud_compra.aprobada')).toBe('Compras')
    expect(moduloDeEvento('nuevo_modulo.algo')).toBe('Otros')
  })
})

describe('agruparMapa', () => {
  const eventos = [
    evento('e-1', 'factura.vencida'),
    evento('e-2', 'pago.registrado'),
    evento('e-3', 'inasistencia.registrada'),
    evento('e-4', 'raro.evento'),
  ]

  it('agrupa por módulo, deja "Otros" al final y cuelga las reglas de su evento', () => {
    const reglas = [
      reglaDe({ id: 'r-2', nombre: 'B regla', tipo_evento_id: 'e-1' }),
      reglaDe({ id: 'r-1', nombre: 'A regla', tipo_evento_id: 'e-1' }),
    ]

    const mapa = agruparMapa(eventos, reglas)

    expect(mapa.map((m) => m.modulo)).toEqual(['Asistencia', 'Facturación', 'Otros'])
    const facturacion = mapa.find((m) => m.modulo === 'Facturación')
    expect(facturacion?.eventos.map((e) => e.evento.id)).toEqual(['e-1', 'e-2'])
    expect(facturacion?.eventos[0].reglas.map((r) => r.id)).toEqual(['r-1', 'r-2'])
  })

  it('un evento sin reglas queda en el mapa con la lista vacía', () => {
    const mapa = agruparMapa(eventos, [reglaDe({ tipo_evento_id: 'e-1' })])

    const sinReglas = mapa.flatMap((m) => m.eventos).filter((e) => e.reglas.length === 0)
    expect(sinReglas.map((e) => e.evento.id)).toEqual(['e-3', 'e-2', 'e-4'])
  })

  it('con el catálogo de prueba usa los mismos eventos', () => {
    expect(agruparMapa([EVENTO_FACTURA], [])[0].modulo).toBe('Facturación')
  })
})

describe('variación', () => {
  it('compara con el período anterior y no inventa un porcentaje sin base', () => {
    expect(variacionPorcentual(150, 100)).toBe(50)
    expect(variacionPorcentual(50, 100)).toBe(-50)
    expect(variacionPorcentual(5, 0)).toBeNull()
  })

  it('el texto nombra el período y el signo', () => {
    expect(textoVariacion(conteo(150), conteo(100), 30)).toBe(
      '+50% frente a los 30 días anteriores',
    )
    expect(textoVariacion(conteo(50), conteo(100), 30)).toBe('-50% frente a los 30 días anteriores')
    expect(textoVariacion(conteo(5), conteo(0), 30)).toBe(
      'Sin ejecuciones en los 30 días anteriores',
    )
    expect(textoVariacion(conteo(0), conteo(0), 30)).toBe('Sin ejecuciones en los últimos 30 días')
  })
})

describe('reglasQueRequierenAtencion', () => {
  const resumen = (id: string, extra: Partial<ResumenRegla>): ResumenRegla => ({
    workflow_rule_id: id,
    ejecuciones: conteo(0),
    serie: [],
    ultima_ejecucion: null,
    fallas_7_dias: 0,
    sin_disparos: false,
    ...extra,
  })

  it('pone primero las que fallaron y después las activas sin disparos', () => {
    const reglas = [
      reglaDe({ id: 'r-1', nombre: 'Quieta' }),
      reglaDe({ id: 'r-2', nombre: 'Fallida' }),
      reglaDe({ id: 'r-3', nombre: 'Sana' }),
      reglaDe({ id: 'r-4', nombre: 'Apagada', activo: false }),
    ]
    const datos = [
      resumen('r-1', { sin_disparos: true }),
      resumen('r-2', { fallas_7_dias: 2 }),
      resumen('r-3', {}),
      resumen('r-4', { sin_disparos: true }),
    ]

    const items = reglasQueRequierenAtencion(reglas, datos, 30)

    expect(items.map((i) => [i.nombre, i.severidad])).toEqual([
      ['Fallida', 'alta'],
      ['Quieta', 'baja'],
    ])
    expect(items[0].motivo).toBe('2 fallas en los últimos 7 días')
    expect(items[1].motivo).toBe('Activa, sin disparos en 30 días')
  })

  it('una regla inactiva con fallas igual se informa', () => {
    const items = reglasQueRequierenAtencion(
      [reglaDe({ id: 'r-1', activo: false })],
      [resumen('r-1', { fallas_7_dias: 1 })],
      30,
    )

    expect(items[0].motivo).toBe('1 falla en los últimos 7 días')
  })
})

describe('tiempoRelativo', () => {
  const ahora = new Date('2026-11-14T12:00:00Z')

  it('describe la última ejecución sin fecha exacta', () => {
    expect(tiempoRelativo(null, ahora)).toBe('Sin ejecuciones')
    expect(tiempoRelativo('2026-11-14T11:59:50Z', ahora)).toBe('hace instantes')
    expect(tiempoRelativo('2026-11-14T11:55:00Z', ahora)).toBe('hace 5 minutos')
    expect(tiempoRelativo('2026-11-14T10:00:00Z', ahora)).toBe('hace 2 horas')
    expect(tiempoRelativo('2026-11-12T12:00:00Z', ahora)).toBe('hace 2 días')
    expect(tiempoRelativo('2026-11-13T12:00:00Z', ahora)).toBe('hace 1 día')
  })
})
