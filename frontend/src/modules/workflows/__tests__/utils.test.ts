import { describe, expect, it } from 'vitest'
import type { CampoEvento, ReglaWorkflow, TipoAccionCatalogo } from '@/modules/workflows/types'
import {
  accionesDisponibles,
  admiteDestinatarios,
  armarCondicion,
  armarConfig,
  armarPayloadRegla,
  cambiarAccion,
  cambiarCampoCondicion,
  cambiarEvento,
  sinConceptosDisponibles,
  defaultsDeConfig,
  duracionEjecucion,
  esEstadoEjecucionFiltro,
  etiquetaEvento,
  filtrarReglas,
  insertarPlaceholder,
  validarPlaceholders,
  valoresDesdeRegla,
  VALORES_REGLA_VACIOS,
} from '@/modules/workflows/utils'

function accion(
  tipo_accion: TipoAccionCatalogo['tipo_accion'],
  eventos_permitidos: string[] | null,
): TipoAccionCatalogo {
  return {
    tipo_accion,
    eventos_permitidos,
    requiere_aprobacion_por_defecto: false,
    admite_plantilla: false,
    config_schema: {},
  }
}

describe('accionesDisponibles', () => {
  const catalogo = [
    accion('notificar', null),
    accion('aplicar_penalidad', ['factura.vencida']),
    accion('generar_orden_compra', []),
  ]

  it('habilita las acciones sin restricción de evento', () => {
    const [notificar] = accionesDisponibles(catalogo, 'pago.registrado')
    expect(notificar).toEqual({ tipo_accion: 'notificar', disponible: true, motivo: null })
  })

  it('habilita solo las acciones cuya lista incluye el evento', () => {
    const resultado = accionesDisponibles(catalogo, 'factura.vencida')
    expect(resultado[1].disponible).toBe(true)
    const otro = accionesDisponibles(catalogo, 'pago.registrado')
    expect(otro[1].disponible).toBe(false)
    expect(otro[1].motivo).toContain('Vence una factura')
  })

  it('deshabilita siempre las acciones sin eventos permitidos', () => {
    const resultado = accionesDisponibles(catalogo, 'factura.vencida')
    expect(resultado[2].disponible).toBe(false)
    expect(resultado[2].motivo).toContain('ningún evento')
  })

  it('no bloquea nada mientras no hay evento elegido', () => {
    const resultado = accionesDisponibles(catalogo, null)
    expect(resultado.slice(0, 2).every((item) => item.disponible)).toBe(true)
  })
})

describe('defaultsDeConfig', () => {
  it('lee los default de properties como texto', () => {
    expect(
      defaultsDeConfig({
        properties: {
          destinatario: { default: 'responsables_habilitados', enum: ['a'], type: 'string' },
          dias_despues: { default: 1, maximum: 90, minimum: 1, type: 'integer' },
        },
      }),
    ).toEqual({ destinatario: 'responsables_habilitados', dias_despues: '1' })
  })

  it('ignora propiedades nullable con default null y las que no tienen default', () => {
    expect(
      defaultsDeConfig({
        properties: {
          mensaje: { anyOf: [{ type: 'string' }, { type: 'null' }], default: null },
          titulo: { type: 'string' },
        },
      }),
    ).toEqual({})
  })

  it('devuelve vacío cuando el schema no tiene propiedades', () => {
    expect(defaultsDeConfig({ title: 'ConfigSinParametros', type: 'object' })).toEqual({})
  })
})

describe('armarCondicion', () => {
  it('devuelve {} cuando no hay campo', () => {
    expect(armarCondicion('', '', '30', 'numero')).toEqual({})
  })

  it('manda un número real en campos numéricos', () => {
    expect(armarCondicion('dias_vencido', '>', '30', 'numero')).toEqual({
      campo: 'dias_vencido',
      operador: '>',
      valor: 30,
    })
  })

  it('deja texto y fecha como texto', () => {
    expect(armarCondicion('motivo', 'contiene', ' beca ', 'texto').valor).toBe('beca')
    expect(armarCondicion('fecha', '>=', '2026-03-01', 'fecha').valor).toBe('2026-03-01')
  })

  it('manda texto si el valor numérico no es válido, para que el backend lo rechace', () => {
    expect(armarCondicion('dias_vencido', '>', 'abc', 'numero').valor).toBe('abc')
  })
})

describe('armarConfig', () => {
  it('no arrastra campos de otra acción ni valores vacíos', () => {
    expect(
      armarConfig('notificar', {
        destinatario: 'responsable_economico',
        titulo: 'viejo',
        dias_despues: '5',
      }),
    ).toEqual({ destinatario: 'responsable_economico' })
  })

  it('convierte enteros a número y deja monto como texto decimal', () => {
    expect(armarConfig('generar_recordatorio', { destinatario: 'x', dias_despues: '7' })).toEqual({
      destinatario: 'x',
      dias_despues: 7,
    })
    expect(armarConfig('generar_cargo', { concepto_cobro_id: 'c-1', monto: '1500.50' })).toEqual({
      concepto_cobro_id: 'c-1',
      monto: '1500.50',
    })
  })

  it('omite un entero que no es número', () => {
    expect(armarConfig('crear_tarea', { titulo: 'Llamar', dias_para_vencer: 'x' })).toEqual({
      titulo: 'Llamar',
    })
  })

  it('conserva regla_penalidad_id y omite el campo si no hay', () => {
    expect(armarConfig('aplicar_penalidad', { regla_penalidad_id: 'p-1' })).toEqual({
      regla_penalidad_id: 'p-1',
    })
    expect(armarConfig('aplicar_penalidad', {})).toEqual({})
  })

  it('fija el registro de crear_registro_relacionado y no manda config en las acciones sin parámetros', () => {
    expect(armarConfig('crear_registro_relacionado', {})).toEqual({
      registro: 'alumno_y_familia_desde_solicitud',
    })
    expect(armarConfig('registrar_pago', { destinatario: 'x' })).toEqual({})
  })
})

const regla: ReglaWorkflow = {
  id: 'r-1',
  nombre: 'Penalidad por mora',
  tipo_evento_id: 'e-1',
  condicion: { campo: 'dias_vencido', operador: '>', valor: 30 },
  tipo_accion: 'aplicar_penalidad',
  accion_config: { regla_penalidad_id: 'p-1' },
  criticidad: 'alta',
  requiere_aprobacion_humana: false,
  notificacion_template_id: null,
  activo: true,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
}

describe('valoresDesdeRegla / armarPayloadRegla', () => {
  it('respeta la aprobación humana guardada aunque difiera del default de la acción', () => {
    expect(valoresDesdeRegla(regla).requiereAprobacionHumana).toBe(false)
  })

  it('carga la plantilla guardada', () => {
    expect(valoresDesdeRegla({ ...regla, notificacion_template_id: 'p-1' }).plantillaId).toBe('p-1')
    expect(valoresDesdeRegla(regla).plantillaId).toBe('')
  })

  it('reemplaza de forma explícita todo lo editable y manda la plantilla elegida', () => {
    const valores = {
      ...valoresDesdeRegla({ ...regla, tipo_accion: 'notificar', accion_config: {} }),
      plantillaId: 'p-1',
    }
    const payload = armarPayloadRegla(valores, 'notificar', {
      tipoDatoCondicion: 'numero',
      admitePlantilla: true,
    })
    expect(payload).toEqual({
      nombre: 'Penalidad por mora',
      tipo_evento_id: 'e-1',
      condicion: { campo: 'dias_vencido', operador: '>', valor: 30 },
      tipo_accion: 'notificar',
      accion_config: {},
      criticidad: 'alta',
      requiere_aprobacion_humana: false,
      notificacion_template_id: 'p-1',
      activo: true,
    })
  })

  it('manda notificacion_template_id null si no se eligió plantilla', () => {
    const payload = armarPayloadRegla(
      { ...VALORES_REGLA_VACIOS, nombre: ' Aviso ', tipoEventoId: 'e-1' },
      'notificar',
      { tipoDatoCondicion: null, admitePlantilla: true },
    )
    expect(payload).toMatchObject({ nombre: 'Aviso', condicion: {}, accion_config: {} })
    expect(payload.notificacion_template_id).toBeNull()
  })

  it('manda notificacion_template_id null si la acción no admite plantilla', () => {
    const payload = armarPayloadRegla(
      { ...valoresDesdeRegla(regla), plantillaId: 'p-1' },
      'aplicar_penalidad',
      { tipoDatoCondicion: 'numero', admitePlantilla: false },
    )
    expect(payload.notificacion_template_id).toBeNull()
    expect(payload.accion_config).toEqual({ regla_penalidad_id: 'p-1' })
  })
})

describe('admiteDestinatarios', () => {
  it('alerta_interna siempre los admite', () => {
    expect(admiteDestinatarios('alerta_interna', {})).toBe(true)
  })

  it('las acciones con plantilla solo con "destinatarios de la regla"', () => {
    for (const tipo of ['notificar', 'generar_recordatorio', 'generar_comunicacion'] as const) {
      expect(admiteDestinatarios(tipo, { destinatario: 'destinatarios_regla' })).toBe(true)
      expect(admiteDestinatarios(tipo, { destinatario: 'responsables_habilitados' })).toBe(false)
      expect(admiteDestinatarios(tipo, {})).toBe(false)
    }
  })

  it('el resto de las acciones no los admite', () => {
    expect(admiteDestinatarios('crear_tarea', { destinatario: 'destinatarios_regla' })).toBe(false)
    expect(admiteDestinatarios('', {})).toBe(false)
  })
})

describe('insertarPlaceholder', () => {
  it('inserta el campo en la posición y deja el cursor después', () => {
    expect(insertarPlaceholder('Hola ,', 5, 'nombre')).toEqual({
      texto: 'Hola {{nombre}},',
      posicion: 15,
    })
  })

  it('acota la posición al largo del texto', () => {
    expect(insertarPlaceholder('abc', 99, 'monto').texto).toBe('abc{{monto}}')
    expect(insertarPlaceholder('abc', -1, 'monto').texto).toBe('{{monto}}abc')
  })
})

describe('validarPlaceholders', () => {
  const campos: CampoEvento[] = [
    { id: 'c-1', nombre_interno: 'monto', etiqueta: 'Monto', tipo_dato: 'numero' },
    { id: 'c-2', nombre_interno: 'dias_vencido', etiqueta: 'Días', tipo_dato: 'numero' },
  ]

  it('no avisa si los placeholders existen en el evento', () => {
    expect(validarPlaceholders('Deuda {{monto}}', '{{dias_vencido}} días', campos)).toBeNull()
    expect(validarPlaceholders('Sin campos', 'Texto', campos)).toBeNull()
  })

  it.each([
    ['llaves sueltas', 'Hola {{monto', 'texto'],
    ['espacios', 'Hola {{ monto }}', 'texto'],
    ['llaves triples', 'Hola', '{{{monto}}}'],
    ['llaves de cierre sueltas', 'Hola', 'monto}}'],
  ])('avisa del formato con %s', (_caso, asunto, cuerpo) => {
    expect(validarPlaceholders(asunto, cuerpo, campos)).toMatch(/formato exacto/)
  })

  it('lista los campos que no existen en el evento', () => {
    expect(validarPlaceholders('{{inventado}}', '{{monto}} {{otro}}', campos)).toBe(
      'Estos campos no existen en el evento: inventado, otro.',
    )
  })
})

describe('filtrarReglas', () => {
  const reglas: ReglaWorkflow[] = [
    regla,
    { ...regla, id: 'r-2', nombre: 'Aviso de mora', tipo_evento_id: 'e-2', activo: false },
  ]

  it('busca por nombre sin distinguir mayúsculas', () => {
    const resultado = filtrarReglas(reglas, {
      busqueda: 'AVISO',
      estado: 'todos',
      tipoEventoId: 'todos',
    })
    expect(resultado.map((item) => item.id)).toEqual(['r-2'])
  })

  it('filtra por estado y por evento', () => {
    expect(
      filtrarReglas(reglas, { busqueda: '', estado: 'activas', tipoEventoId: 'todos' }).map(
        (r) => r.id,
      ),
    ).toEqual(['r-1'])
    expect(
      filtrarReglas(reglas, { busqueda: '', estado: 'todos', tipoEventoId: 'e-2' }).map(
        (r) => r.id,
      ),
    ).toEqual(['r-2'])
  })
})

describe('cambiarEvento', () => {
  const catalogo = [accion('notificar', null), accion('aplicar_penalidad', ['factura.vencida'])]
  const valores = {
    ...VALORES_REGLA_VACIOS,
    tipoEventoId: 'e-1',
    campoCondicion: 'dias_vencido',
    operadorCondicion: '>' as const,
    valorCondicion: '30',
    tipoAccion: 'aplicar_penalidad' as const,
    config: { regla_penalidad_id: 'p-1', campo_monto: 'monto_deuda', estado_nuevo: 'vencida' },
  }

  it('limpia la condición y la config que depende del evento', () => {
    const resultado = cambiarEvento(valores, 'e-2', catalogo, 'factura.vencida')
    expect(resultado).toMatchObject({
      tipoEventoId: 'e-2',
      campoCondicion: '',
      operadorCondicion: '',
      valorCondicion: '',
      tipoAccion: 'aplicar_penalidad',
      config: { regla_penalidad_id: 'p-1' },
    })
  })

  it('limpia la plantilla solo si también limpia la acción', () => {
    const conPlantilla = { ...valores, plantillaId: 'p-1' }
    expect(cambiarEvento(conPlantilla, 'e-2', catalogo, 'factura.vencida').plantillaId).toBe('p-1')
    expect(cambiarEvento(conPlantilla, 'e-3', catalogo, 'pago.registrado').plantillaId).toBe('')
  })

  it('limpia la acción si el nuevo evento no la admite', () => {
    const resultado = cambiarEvento(valores, 'e-3', catalogo, 'pago.registrado')
    expect(resultado.tipoAccion).toBe('')
    expect(resultado.config).toEqual({})
  })
})

describe('cambiarAccion', () => {
  it('conserva la plantilla si la acción nueva la admite y la limpia si no', () => {
    const valores = {
      ...VALORES_REGLA_VACIOS,
      tipoAccion: 'notificar' as const,
      plantillaId: 'p-1',
    }
    const conPlantilla = { ...accion('alerta_interna', null), admite_plantilla: true }
    expect(cambiarAccion(valores, conPlantilla).plantillaId).toBe('p-1')
    expect(cambiarAccion(valores, accion('crear_tarea', null)).plantillaId).toBe('')
  })

  it('reinicia la config con los defaults y aplica la aprobación por defecto', () => {
    const resultado = cambiarAccion(
      { ...VALORES_REGLA_VACIOS, tipoAccion: 'notificar', config: { destinatario: 'x' } },
      {
        ...accion('generar_recordatorio', null),
        requiere_aprobacion_por_defecto: true,
        config_schema: { properties: { dias_despues: { default: 1 } } },
      },
    )
    expect(resultado).toMatchObject({
      tipoAccion: 'generar_recordatorio',
      config: { dias_despues: '1' },
      requiereAprobacionHumana: true,
    })
  })
})

describe('cambiarCampoCondicion', () => {
  it('elige el primer operador válido del tipo de dato y vacía el valor', () => {
    const resultado = cambiarCampoCondicion(
      { ...VALORES_REGLA_VACIOS, valorCondicion: 'viejo' },
      { id: 'c-1', nombre_interno: 'motivo', etiqueta: 'Motivo', tipo_dato: 'texto' },
    )
    expect(resultado).toMatchObject({
      campoCondicion: 'motivo',
      operadorCondicion: '==',
      valorCondicion: '',
    })
  })

  it('sin campo deja la regla sin condición', () => {
    expect(cambiarCampoCondicion(VALORES_REGLA_VACIOS, null).campoCondicion).toBe('')
  })
})

describe('sinConceptosDisponibles', () => {
  it('bloquea solo las acciones que piden concepto de cobro', () => {
    const resultado = sinConceptosDisponibles(
      accionesDisponibles(
        [accion('notificar', null), accion('generar_cargo', ['pago.rechazado'])],
        'pago.rechazado',
      ),
    )
    expect(resultado[0].disponible).toBe(true)
    expect(resultado[1].disponible).toBe(false)
    expect(resultado[1].motivo).toContain('conceptos de cobro')
  })
})

describe('etiquetaEvento', () => {
  it('nombra el evento en lenguaje de usuario y cae al nombre interno si no lo conoce', () => {
    expect(etiquetaEvento('factura.vencida')).toBe('Vence una factura')
    expect(etiquetaEvento('evento.nuevo')).toBe('evento.nuevo')
  })
})

describe('esEstadoEjecucionFiltro', () => {
  it('acepta los estados y también "todos"', () => {
    expect(esEstadoEjecucionFiltro('todos')).toBe(true)
    expect(esEstadoEjecucionFiltro('fallido')).toBe(true)
    expect(esEstadoEjecucionFiltro('otro')).toBe(false)
  })
})

describe('duracionEjecucion', () => {
  it('devuelve null si la ejecución sigue en curso', () => {
    expect(duracionEjecucion('2026-09-01T10:00:00Z', null)).toBeNull()
  })

  it('formatea segundos, minutos y horas', () => {
    expect(duracionEjecucion('2026-09-01T10:00:00Z', '2026-09-01T10:00:05Z')).toBe('5 s')
    expect(duracionEjecucion('2026-09-01T10:00:00Z', '2026-09-01T10:02:10Z')).toBe('2 min 10 s')
    expect(duracionEjecucion('2026-09-01T10:00:00Z', '2026-09-01T11:05:00Z')).toBe('1 h 5 min')
  })
})
