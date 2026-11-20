import { describe, expect, it } from 'vitest'
import {
  TIPOS_RECURSO_ACADEMICO,
  type DestinoNotificacion,
  type TipoRecursoNotificacion,
} from '@/modules/notificaciones/types'
import {
  etiquetaTiempoNotificacion,
  leerDestinoDesdeParametros,
  rutaDesdeDestino,
} from '@/modules/notificaciones/utils'

function crearDestino(overrides: Partial<DestinoNotificacion> = {}): DestinoNotificacion {
  return {
    tipo: 'asistencia',
    id: 'asistencia-1',
    alumno_id: 'alumno-1',
    ...overrides,
  }
}

describe('rutaDesdeDestino', () => {
  it('arma la ruta tipada del historial para una inasistencia', () => {
    expect(rutaDesdeDestino(crearDestino())).toBe(
      '/familia/asistencias?alumno=alumno-1&seccion=historial&recurso=asistencia&recurso_id=asistencia-1',
    )
  })

  it('arma la ruta tipada del historial para una justificación individual', () => {
    expect(
      rutaDesdeDestino(crearDestino({ tipo: 'justificacion_individual', id: 'justificacion-1' })),
    ).toBe(
      '/familia/asistencias?alumno=alumno-1&seccion=historial&recurso=justificacion_individual&recurso_id=justificacion-1',
    )
  })

  it('arma la ruta tipada de justificaciones para una solicitud por período', () => {
    expect(
      rutaDesdeDestino(crearDestino({ tipo: 'solicitud_ausencia_periodo', id: 'solicitud-1' })),
    ).toBe(
      '/familia/asistencias?alumno=alumno-1&seccion=justificaciones&recurso=solicitud_ausencia_periodo&recurso_id=solicitud-1',
    )
  })

  it('arma la ruta de una comunicación institucional', () => {
    expect(rutaDesdeDestino({ tipo: 'comunicacion', id: 'comunicacion-1', alumno_id: null })).toBe(
      '/familia/comunicaciones/comunicacion-1',
    )
  })

  it('abre exactamente la conversación contextual notificada', () => {
    expect(rutaDesdeDestino(crearDestino({ tipo: 'conversacion', id: 'hilo-1' }))).toBe(
      '/familia/conversaciones/hilo-1',
    )
  })

  it('arma la ruta de facturación para una factura o un pago', () => {
    expect(rutaDesdeDestino({ tipo: 'factura', id: 'factura-1', alumno_id: 'alumno-1' })).toBe(
      '/familia/facturacion?factura=factura-1',
    )
    expect(rutaDesdeDestino({ tipo: 'pago', id: 'pago-1', alumno_id: 'alumno-1' })).toBe(
      '/familia/facturacion?pago=pago-1',
    )
  })

  it('no inventa una URL con un destino desconocido o incompleto', () => {
    expect(rutaDesdeDestino(null)).toBeNull()
    expect(rutaDesdeDestino(undefined)).toBeNull()
    expect(
      rutaDesdeDestino(crearDestino({ tipo: 'facturacion.factura' as TipoRecursoNotificacion })),
    ).toBeNull()
    expect(rutaDesdeDestino(crearDestino({ id: '' }))).toBeNull()
    expect(rutaDesdeDestino(crearDestino({ alumno_id: '' }))).toBeNull()
  })
})

describe('leerDestinoDesdeParametros', () => {
  it('lee los parámetros tipados de la URL', () => {
    const parametros = new URLSearchParams(
      'alumno=alumno-2&seccion=historial&recurso=justificacion_individual&recurso_id=justificacion-9',
    )

    expect(leerDestinoDesdeParametros(parametros)).toEqual({
      alumnoId: 'alumno-2',
      seccion: 'historial',
      recurso: 'justificacion_individual',
      recursoId: 'justificacion-9',
    })
  })

  it('ignora parámetros incompletos o con valores no tipados', () => {
    expect(leerDestinoDesdeParametros(new URLSearchParams(''))).toBeNull()
    expect(
      leerDestinoDesdeParametros(
        new URLSearchParams('alumno=alumno-1&seccion=otra&recurso=asistencia&recurso_id=a-1'),
      ),
    ).toBeNull()
    expect(
      leerDestinoDesdeParametros(
        new URLSearchParams('alumno=alumno-1&seccion=historial&recurso=otro&recurso_id=a-1'),
      ),
    ).toBeNull()
    expect(
      leerDestinoDesdeParametros(
        new URLSearchParams('alumno=alumno-1&seccion=historial&recurso=asistencia'),
      ),
    ).toBeNull()
    for (const recurso of TIPOS_RECURSO_ACADEMICO) {
      const seccion = recurso === 'solicitud_ausencia_periodo' ? 'justificaciones' : 'historial'
      expect(
        leerDestinoDesdeParametros(
          new URLSearchParams(
            `alumno=alumno-1&seccion=${seccion}&recurso=${recurso}&recurso_id=recurso-1`,
          ),
        ),
      ).not.toBeNull()
    }
  })
})

describe('etiquetaTiempoNotificacion', () => {
  const ahora = new Date('2026-11-17T15:00:00Z') // 12:00 en Buenos Aires

  it('usa minutos y horas relativas recientes', () => {
    expect(etiquetaTiempoNotificacion('2026-11-17T14:59:30Z', ahora)).toBe('Ahora')
    expect(etiquetaTiempoNotificacion('2026-11-17T14:50:00Z', ahora)).toBe('Hace 10 min')
    expect(etiquetaTiempoNotificacion('2026-11-17T13:00:00Z', ahora)).toBe('Hace 2 h')
  })

  it('usa el día local para lo anterior de hoy y de ayer', () => {
    expect(etiquetaTiempoNotificacion('2026-11-17T05:00:00Z', ahora)).toBe('Hoy, 02:00')
    expect(etiquetaTiempoNotificacion('2026-11-16T13:00:00Z', ahora)).toBe('Ayer')
  })

  it('usa la fecha local para lo anterior a ayer', () => {
    expect(etiquetaTiempoNotificacion('2026-11-12T13:00:00Z', ahora)).toBe('12 nov')
    expect(etiquetaTiempoNotificacion('2025-11-12T13:00:00Z', ahora)).toBe('12 nov 2025')
  })

  it('no rompe con una fecha inválida', () => {
    expect(etiquetaTiempoNotificacion('no-es-una-fecha', ahora)).toBe('—')
  })
})
