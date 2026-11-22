import { describe, expect, it } from 'vitest'
import {
  etiquetaAccion,
  etiquetaEntidad,
  etiquetaUsuario,
  formatearCampo,
  nombreActor,
} from '@/modules/auditoria/utils'

describe('etiquetaAccion', () => {
  it('traduce los códigos de acción del backend a una palabra entendible', () => {
    expect(etiquetaAccion('__alta__')).toBe('Alta')
    expect(etiquetaAccion('__eliminacion__')).toBe('Eliminación')
    expect(etiquetaAccion('__aprobacion__')).toBe('Aprobación')
    expect(etiquetaAccion('__rechazo__')).toBe('Rechazo')
  })

  it('un cambio de campo real es una modificación', () => {
    expect(etiquetaAccion('estado')).toBe('Modificación')
    expect(etiquetaAccion('numero_legajo')).toBe('Modificación')
  })

  it('un código desconocido se muestra sin guiones bajos', () => {
    expect(etiquetaAccion('__cancelacion_manual__')).toBe('Cancelacion Manual')
  })
})

describe('etiquetaEntidad', () => {
  it('usa el nombre visible y no distingue mayúsculas', () => {
    expect(etiquetaEntidad('ALUMNO')).toBe('Alumno')
    expect(etiquetaEntidad('alumno')).toBe('Alumno')
    expect(etiquetaEntidad('solicitud_ausencia_periodo')).toBe(
      'Solicitud de ausencia por período',
    )
  })

  it('una entidad fuera del catálogo se capitaliza palabra por palabra', () => {
    expect(etiquetaEntidad('beca_asignada')).toBe('Beca Asignada')
  })
})

describe('formatearCampo', () => {
  it('usa el nombre visible de los campos conocidos', () => {
    expect(formatearCampo('estado_envio')).toBe('Estado de envío')
    expect(formatearCampo('numero_legajo')).toBe('Número de legajo')
  })

  it('capitaliza cada palabra de un campo desconocido', () => {
    expect(formatearCampo('campo_nuevo')).toBe('Campo Nuevo')
  })

  it('las acciones también se traducen cuando se usan como etiqueta de campo', () => {
    expect(formatearCampo('__alta__')).toBe('Alta')
  })
})

describe('nombreActor', () => {
  it('para una operación automática muestra el sistema', () => {
    expect(
      nombreActor({ actor_tipo: 'sistema', usuario_nombre: null, usuario_email: null }),
    ).toBe('Sistema')
  })

  it('prioriza el nombre de la persona y cae al email', () => {
    expect(
      nombreActor({
        actor_tipo: 'usuario',
        usuario_nombre: 'Ana Pérez',
        usuario_email: 'ana@esseri.edu.ar',
      }),
    ).toBe('Ana Pérez')
    expect(
      nombreActor({
        actor_tipo: 'usuario',
        usuario_nombre: null,
        usuario_email: 'ana@esseri.edu.ar',
      }),
    ).toBe('ana@esseri.edu.ar')
  })
})

describe('etiquetaUsuario', () => {
  it('muestra el nombre y cae al email', () => {
    expect(etiquetaUsuario({ id: '1', email: 'ana@esseri.edu.ar', nombre: 'Ana Pérez' })).toBe(
      'Ana Pérez',
    )
    expect(etiquetaUsuario({ id: '2', email: 'ana@esseri.edu.ar', nombre: null })).toBe(
      'ana@esseri.edu.ar',
    )
  })
})
