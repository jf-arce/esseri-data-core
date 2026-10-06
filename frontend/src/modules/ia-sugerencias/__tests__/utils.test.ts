import { describe, expect, it } from 'vitest'
import type { Sugerencia } from '@/modules/ia-sugerencias/types'
import {
  etiquetaAfectado,
  mensajeDeteccion,
  resumenSugerencia,
  separarSugerencias,
} from '@/modules/ia-sugerencias/utils'

function sugerencia(overrides: Partial<Sugerencia>): Sugerencia {
  return {
    id: 's1',
    tipo: 'patron_detectado',
    entidad: 'familia',
    entidad_id: 'f1',
    contenido_generado: 'La familia Cabral, Lorena tiene deuda vencida.',
    requiere_control_humano: true,
    estado: 'pendiente_revision',
    fecha_generacion: '2026-10-05T10:00:00',
    fecha_revision: null,
    usuario_id: null,
    revisor_email: null,
    comunicacion: null,
    notificacion_template_id: null,
    ...overrides,
  }
}

describe('separarSugerencias', () => {
  it('manda a la bandeja solo las pendientes y al historial todo lo ya resuelto', () => {
    const pendiente = sugerencia({ id: 'a' })
    const aprobada = sugerencia({ id: 'b', estado: 'aprobada' })
    const rechazada = sugerencia({ id: 'c', estado: 'rechazada' })
    const automatica = sugerencia({ id: 'd', estado: 'ejecutada_automaticamente' })

    const { pendientes, resueltas } = separarSugerencias([
      aprobada,
      pendiente,
      rechazada,
      automatica,
    ])

    expect(pendientes).toEqual([pendiente])
    expect(resueltas).toEqual([aprobada, rechazada, automatica])
  })

  it('con el listado vacío devuelve las dos listas vacías', () => {
    expect(separarSugerencias([])).toEqual({ pendientes: [], resueltas: [] })
  })
})

describe('etiquetaAfectado', () => {
  it('traduce las entidades conocidas', () => {
    expect(etiquetaAfectado('familia')).toBe('Familia')
    expect(etiquetaAfectado('alumno')).toBe('Alumno')
  })

  it('muestra tal cual una entidad que todavía no conoce, y un guion si no hay', () => {
    expect(etiquetaAfectado('docente')).toBe('docente')
    expect(etiquetaAfectado(null)).toBe('—')
  })
})

describe('resumenSugerencia', () => {
  it('en un patrón es el texto de la sugerencia', () => {
    expect(resumenSugerencia(sugerencia({}))).toBe('La familia Cabral, Lorena tiene deuda vencida.')
  })

  it('en una comunicación es el nombre y el asunto, nunca el borrador serializado', () => {
    const comunicacion = sugerencia({
      tipo: 'comunicacion',
      entidad: 'tipo_evento',
      contenido_generado: '{"nombre":"Recordatorio","asunto":"Aviso"}',
      comunicacion: {
        nombre: 'Recordatorio de deuda',
        asunto: 'Aviso de cuota vencida',
        cuerpo: 'Hola {{nombre_familia}}',
        instrucciones: 'Recordatorio amable.',
      },
    })

    expect(resumenSugerencia(comunicacion)).toBe('Recordatorio de deuda: Aviso de cuota vencida')
    expect(etiquetaAfectado(comunicacion.entidad)).toBe('Evento')
  })
})

describe('mensajeDeteccion', () => {
  const creadas = (cantidad: number) =>
    Array.from({ length: cantidad }, (_, indice) => sugerencia({ id: `n${indice}` }))

  it('distingue no encontrar nada de encontrar solo casos que ya estaban pendientes', () => {
    expect(mensajeDeteccion({ creadas: [], ya_pendientes: 0 })).toBe(
      'No se encontraron patrones para revisar.',
    )
    expect(mensajeDeteccion({ creadas: [], ya_pendientes: 1 })).toBe(
      'No hay nada nuevo: el caso detectado ya estaba pendiente de revisión.',
    )
    expect(mensajeDeteccion({ creadas: [], ya_pendientes: 3 })).toBe(
      'No hay nada nuevo: los 3 casos detectados ya estaban pendientes de revisión.',
    )
  })

  it('usa singular o plural según cuántas sugerencias se generaron', () => {
    expect(mensajeDeteccion({ creadas: creadas(1), ya_pendientes: 0 })).toBe(
      'Se generó 1 sugerencia nueva.',
    )
    expect(mensajeDeteccion({ creadas: creadas(4), ya_pendientes: 0 })).toBe(
      'Se generaron 4 sugerencias nuevas.',
    )
  })

  it('avisa cuando además había casos que ya estaban en la bandeja', () => {
    expect(mensajeDeteccion({ creadas: creadas(2), ya_pendientes: 5 })).toBe(
      'Se generaron 2 sugerencias nuevas. Otros casos ya estaban pendientes: 5.',
    )
  })
})
