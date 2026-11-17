import { describe, expect, it } from 'vitest'
import type { Permiso } from '@/modules/auth/types'
import { COMANDOS } from '../constants'
import type { BloqueTabla, MensajeVisible } from '../types'
import {
  aliasDeMensajes,
  atajoAlInicio,
  separarComando,
  comandosDisponibles,
  consultaDeComando,
  coincideConBusqueda,
  consultaDeMencion,
  nombreCorrido,
  ordenarFilas,
  siguienteOrden,
  etiquetaDeDestino,
  etiquetaDePantalla,
  etiquetaGenerica,
  armarCopia,
  cortarSeguro,
  formatearCelda,
  parsearSse,
  partirTextoConAlias,
  RUTAS_DE_DESTINO,
  rutaDeDestino,
  rutaDeEntidad,
  sugerenciasPermitidas,
  sustituirAlias,
  resolverEnvio,
  tonoDeKpi,
  iconoDeKpi,
  armarCopiaTabla,
  esColumnaDeCambio,
} from '../utils'

function permiso(codigo: string): Permiso {
  return {
    id: codigo,
    codigo,
    modulo: codigo.split('.')[0],
    accion: codigo.split('.')[1],
    tipo_informacion: null,
  }
}

describe('parsearSse', () => {
  const bloque = (evento: string, datos: object) =>
    `event: ${evento}\ndata: ${JSON.stringify(datos)}\n\n`

  it('parsea eventos completos', () => {
    const { eventos, resto } = parsearSse(
      '',
      bloque('texto', { solicitud_id: 'a', texto: 'Hola' }) +
        bloque('fin', { solicitud_id: 'a', mensaje_id: 'm' }),
    )
    expect(eventos.map((e) => e.evento)).toEqual(['texto', 'fin'])
    expect(eventos[0].datos).toMatchObject({ texto: 'Hola' })
    expect(resto).toBe('')
  })

  it('junta un evento partido entre dos fragmentos', () => {
    const entero = bloque('texto', { solicitud_id: 'a', texto: 'Hola' })
    const primero = parsearSse('', entero.slice(0, 20))
    expect(primero.eventos).toEqual([])
    const segundo = parsearSse(primero.resto, entero.slice(20))
    expect(segundo.eventos).toHaveLength(1)
  })

  it('acepta saltos de línea CRLF', () => {
    const crlf = bloque('texto', { solicitud_id: 'a', texto: 'x' }).replace(/\n/g, '\r\n')
    expect(parsearSse('', crlf).eventos).toHaveLength(1)
  })

  it('ignora eventos desconocidos y datos que no son JSON', () => {
    const { eventos } = parsearSse(
      '',
      'event: raro\ndata: {}\n\nevent: texto\ndata: no-json\n\n' +
        bloque('texto', { solicitud_id: 'a', texto: 'ok' }),
    )
    expect(eventos).toHaveLength(1)
  })

  it('deja el resto sin terminar para el próximo fragmento', () => {
    const { eventos, resto } = parsearSse('', 'event: texto\ndata: {"a"')
    expect(eventos).toEqual([])
    expect(resto).toBe('event: texto\ndata: {"a"')
  })
})

describe('partirTextoConAlias', () => {
  it('separa el texto de los alias', () => {
    expect(partirTextoConAlias('Mirá a [ALUMNO:1] y a [FAMILIA:2].')).toEqual([
      { tipo: 'texto', valor: 'Mirá a ' },
      { tipo: 'alias', alias: '[ALUMNO:1]' },
      { tipo: 'texto', valor: ' y a ' },
      { tipo: 'alias', alias: '[FAMILIA:2]' },
      { tipo: 'texto', valor: '.' },
    ])
  })

  it('un texto sin alias queda entero', () => {
    expect(partirTextoConAlias('Sin personas')).toEqual([{ tipo: 'texto', valor: 'Sin personas' }])
  })

  it('no toma como alias un corchete cualquiera', () => {
    expect(partirTextoConAlias('[otro:1] [ALUMNO:x]')).toEqual([
      { tipo: 'texto', valor: '[otro:1] [ALUMNO:x]' },
    ])
  })
})

describe('rutaDeDestino', () => {
  const direccion = [
    permiso('panel_administrativo.leer'),
    permiso('facturacion.leer'),
    permiso('familias_alumnos.leer'),
  ]

  it('devuelve la ruta si el menú del rol la muestra', () => {
    expect(rutaDeDestino('deuda_por_familia', 'direccion', direccion)).toBe(
      '/facturacion/deudas/familias',
    )
  })

  it('rechaza un destino que el rol no ve en su menú', () => {
    expect(rutaDeDestino('usuarios', 'direccion', direccion)).toBeNull()
    expect(rutaDeDestino('deuda_por_familia', 'direccion', [])).toBeNull()
  })

  it('abre Académico filtrado por nivel, año y división', () => {
    const ids = {
      nivel: '11111111-1111-4111-8111-111111111111',
      anio: '22222222-2222-4222-8222-222222222222',
      division: '33333333-3333-4333-8333-333333333333',
    }
    const permisos = [...direccion, permiso('academico.leer')]
    expect(rutaDeDestino('academico', 'direccion', permisos, ids)).toBe(
      `/academico?nivel=${ids.nivel}&anio=${ids.anio}&division=${ids.division}`,
    )
  })

  it('descarta filtros que no son ids o que la pantalla no usa', () => {
    const permisos = [...direccion, permiso('academico.leer')]
    expect(
      rutaDeDestino('academico', 'direccion', permisos, { nivel: 'primario', otro: 'x' }),
    ).toBe('/academico')
    expect(
      rutaDeDestino('deuda_por_familia', 'direccion', direccion, {
        nivel: '11111111-1111-4111-8111-111111111111',
      }),
    ).toBe('/facturacion/deudas/familias')
  })

  it('rechaza claves desconocidas y URLs armadas por el modelo', () => {
    expect(rutaDeDestino('https://evil.test', 'direccion', direccion)).toBeNull()
    expect(rutaDeDestino('/facturacion', 'direccion', direccion)).toBeNull()
    expect(rutaDeDestino('__proto__', 'direccion', direccion)).toBeNull()
  })

  it('todas las rutas del mapa son internas', () => {
    for (const ruta of Object.values(RUTAS_DE_DESTINO)) {
      expect(ruta.startsWith('/')).toBe(true)
      expect(ruta.startsWith('//')).toBe(false)
    }
  })
})

describe('rutaDeEntidad', () => {
  it('arma las mismas rutas que el buscador global', () => {
    expect(rutaDeEntidad('ALUMNO', 'abc')).toBe('/familias-alumnos/alumnos/abc')
    expect(rutaDeEntidad('FAMILIA', 'abc')).toBe('/familias-alumnos/familias/abc')
  })

  it('escapa el id', () => {
    expect(rutaDeEntidad('ALUMNO', 'a/../b')).toBe('/familias-alumnos/alumnos/a%2F..%2Fb')
  })
})

describe('formatearCelda', () => {
  it('distingue "sin registros" de 0 %', () => {
    expect(formatearCelda(null, 'porcentaje')).toBe('Sin registros')
    expect(formatearCelda(0, 'porcentaje')).toBe('0 %')
  })

  it('formatea importes en pesos', () => {
    expect(formatearCelda(1500, 'moneda')).toContain('1.500')
  })
})

describe('aliasDeMensajes', () => {
  it('junta los alias del texto, las tarjetas y las columnas de tipo alias', () => {
    const mensajes: MensajeVisible[] = [
      {
        id: '1',
        autor: 'asistente',
        contenido: 'Mirá a [ALUMNO:1]',
        estado: 'completo',
        herramienta: null,
        pasos: [],
        bloques: [
          { tipo: 'tarjeta', entidad: 'alumno', alias: '[ALUMNO:1]' },
          {
            tipo: 'tabla',
            tabla_id: 't',
            titulo: 'Deuda',
            columnas: [{ clave: 'familia', etiqueta: 'Familia', tipo: 'alias' }],
            filas: [{ familia: '[FAMILIA:1]' }, { familia: '[FAMILIA:2]' }],
            periodo: '',
            fuente: '',
          },
        ],
      },
    ]
    expect(aliasDeMensajes(mensajes).sort()).toEqual(['[ALUMNO:1]', '[FAMILIA:1]', '[FAMILIA:2]'])
  })
})

describe('sustituirAlias', () => {
  const resuelto = {
    '[ALUMNO:1]': {
      alias: '[ALUMNO:1]',
      tipo: 'ALUMNO' as const,
      entidad_id: 'abc',
      nombre: 'Quintero, Mariana',
    },
  }

  it('reemplaza los alias resueltos por un link a su ficha', () => {
    expect(sustituirAlias('Mirá a [ALUMNO:1].', resuelto)).toBe(
      'Mirá a [Mariana Quintero](/familias-alumnos/alumnos/abc).',
    )
  })

  it('deja una etiqueta genérica en negrita si no se resolvió', () => {
    expect(sustituirAlias('Mirá a [FAMILIA:2].', {})).toBe('Mirá a **Familia 2**.')
  })

  it('escapa los caracteres de markdown del nombre', () => {
    const raro = {
      '[ALUMNO:1]': { ...resuelto['[ALUMNO:1]'], nombre: 'O]pen [x](http://evil.test)' },
    }
    expect(sustituirAlias('[ALUMNO:1]', raro)).toBe(
      '[O\\]pen \\[x\\]\\(http://evil\\.test\\)](/familias-alumnos/alumnos/abc)'.replace(
        '\\.',
        '.',
      ),
    )
  })
})

describe('sugerenciasPermitidas', () => {
  it('ofrece solo las preguntas de los datos que el rol puede leer', () => {
    const textos = sugerenciasPermitidas([permiso('facturacion.leer')])
    expect(textos).toHaveLength(1)
    expect(textos[0]).toContain('deuda')
  })

  it('no ofrece nada sin permisos', () => {
    expect(sugerenciasPermitidas([])).toEqual([])
  })
})

describe('cortarSeguro', () => {
  it('devuelve el texto entero si el corte lo cubre', () => {
    expect(cortarSeguro('hola', 10)).toBe('hola')
  })

  it('no deja a la vista un alias a medio escribir', () => {
    expect(cortarSeguro('Ver [ALUMNO:12] hoy', 10)).toBe('Ver ')
    expect(cortarSeguro('Ver [ALUMNO:12] hoy', 15)).toBe('Ver [ALUMNO:12]')
  })

  it('cierra una negrita abierta para que no se vean los asteriscos', () => {
    expect(cortarSeguro('Hay **3 alumnos** hoy', 8)).toBe('Hay **3**')
    expect(cortarSeguro('Hay **3 alumnos** hoy', 17)).toBe('Hay **3 alumnos**')
  })
})

describe('armarCopia', () => {
  const tabla = {
    tipo: 'tabla' as const,
    tabla_id: 't',
    titulo: 'Deuda por familia',
    columnas: [
      { clave: 'familia', etiqueta: 'Familia', tipo: 'alias' as const },
      { clave: 'vencido', etiqueta: 'Vencido', tipo: 'moneda' as const },
    ],
    filas: [{ familia: '[FAMILIA:1]', vencido: 1560000 }],
    periodo: 'al 13/11/2026',
    fuente: 'Cuenta corriente',
  }
  const porAlias = {
    '[FAMILIA:1]': {
      alias: '[FAMILIA:1]',
      tipo: 'FAMILIA' as const,
      entidad_id: 'f1',
      nombre: 'Torres, Andrés',
    },
  }

  it('incluye la tabla con tabuladores y el nombre real', () => {
    const { texto } = armarCopia('Hay 12 familias.', [tabla], porAlias)
    expect(texto).toContain('Hay 12 familias.')
    expect(texto).toContain('Familia\tVencido')
    expect(texto).toContain('Torres, Andrés\t$')
    expect(texto).toContain('al 13/11/2026 · Cuenta corriente')
  })

  it('arma una tabla html y escapa el contenido', () => {
    const { html } = armarCopia('a < b', [tabla], porAlias)
    expect(html).toContain('<p>a &lt; b</p>')
    expect(html).toContain('<th>Familia</th>')
    expect(html).toContain('<td>Torres, Andrés</td>')
  })

  it('incluye los indicadores', () => {
    const kpi = {
      tipo: 'kpi' as const,
      titulo: 'Alumnos activos',
      valor: 320,
      unidad: '',
      periodo: 'al 13/11/2026',
      fuente: 'Inscripciones',
    }
    expect(armarCopia('Listo.', [kpi], {}).texto).toContain(
      'Alumnos activos: 320 (al 13/11/2026 · Inscripciones)',
    )
  })
})

describe('alias de docentes', () => {
  it('no tienen ficha: la ruta es nula', () => {
    expect(rutaDeEntidad('DOCENTE', 'd1')).toBeNull()
  })

  it('se reconocen en el texto y tienen etiqueta propia', () => {
    expect(partirTextoConAlias('Da [DOCENTE:2] hoy')).toEqual([
      { tipo: 'texto', valor: 'Da ' },
      { tipo: 'alias', alias: '[DOCENTE:2]' },
      { tipo: 'texto', valor: ' hoy' },
    ])
    expect(etiquetaGenerica('[DOCENTE:2]')).toBe('Docente 2')
  })

  it('se muestran en negrita y sin link una vez resueltos', () => {
    const resuelto = {
      alias: '[DOCENTE:2]',
      tipo: 'DOCENTE' as const,
      entidad_id: 'd1',
      nombre: 'Ferrero, Graciela',
    }
    expect(sustituirAlias('Da [DOCENTE:2]', { '[DOCENTE:2]': resuelto })).toBe(
      'Da **Graciela Ferrero**',
    )
  })
})

describe('etiquetaDeDestino', () => {
  it('una clave desconocida no tiene etiqueta', () => {
    expect(etiquetaDeDestino('no_existe', null, [])).toBeNull()
  })
})

describe('etiquetaDePantalla', () => {
  const permisos = [permiso('academico.leer'), permiso('facturacion.leer')]

  it('usa el nombre del menú de la pantalla en que está', () => {
    const academico = etiquetaDeDestino('academico', 'direccion', permisos)
    expect(academico).not.toBeNull()
    expect(etiquetaDePantalla('/academico', 'direccion', permisos)).toBe(academico)
  })

  it('en una subpantalla gana la entrada más específica', () => {
    const historial = etiquetaDeDestino('historial_asistencia', 'direccion', permisos)
    expect(historial).not.toBeNull()
    expect(etiquetaDePantalla('/academico/historial-asistencia', 'direccion', permisos)).toBe(
      historial,
    )
  })

  it('una pantalla anidada sin entrada propia usa la del módulo', () => {
    expect(etiquetaDePantalla('/academico/algo/mas', 'direccion', permisos)).toBe(
      etiquetaDePantalla('/academico', 'direccion', permisos),
    )
  })

  it('sin permiso o fuera del menú no hay pantalla', () => {
    expect(etiquetaDePantalla('/academico', 'direccion', [])).toBeNull()
    expect(etiquetaDePantalla('/no-existe', 'direccion', permisos)).toBeNull()
  })

  it('no confunde rutas que solo comparten el comienzo', () => {
    expect(etiquetaDePantalla('/academicos', 'direccion', permisos)).toBeNull()
  })
})

describe('coincideConBusqueda', () => {
  const curso = '3°A de Primario'

  it.each(['3', 'a', '3a', '3 a', '3° a', '3°A', 'prim', 'primario', '3a prim', 'A 3', 'DE'])(
    'encuentra el curso al escribir "%s"',
    (escrito) => expect(coincideConBusqueda(curso, escrito)).toBe(true),
  )

  it.each(['b', '3b', '4', '3 b', 'secundario', 'rio'])(
    'no encuentra el curso al escribir "%s"',
    (escrito) => expect(coincideConBusqueda(curso, escrito)).toBe(false),
  )

  it('una letra suelta no coincide con el medio de otra palabra', () => {
    expect(coincideConBusqueda('3°B de Primario', 'a')).toBe(false)
  })

  it('en nombres de personas no distingue tildes ni orden', () => {
    expect(coincideConBusqueda('Ana Pérez', 'perez ana')).toBe(true)
    expect(coincideConBusqueda('Ana Pérez', 'PÉR')).toBe(true)
  })

  it('lo escrito vacío coincide con todo', () => {
    expect(coincideConBusqueda(curso, '')).toBe(true)
  })
})

describe('nombreCorrido', () => {
  it('pasa "Apellido, Nombre" a "Nombre Apellido"', () => {
    expect(nombreCorrido('Navarro, Camila')).toBe('Camila Navarro')
  })

  it('deja igual un nombre sin coma', () => {
    expect(nombreCorrido('Camila Navarro')).toBe('Camila Navarro')
  })

  it('en el texto, una lista de personas no se confunde con las comas del apellido', () => {
    const porAlias = {
      '[DOCENTE:1]': {
        alias: '[DOCENTE:1]',
        tipo: 'DOCENTE' as const,
        entidad_id: 'a',
        nombre: 'Navarro, Camila',
      },
      '[DOCENTE:2]': {
        alias: '[DOCENTE:2]',
        tipo: 'DOCENTE' as const,
        entidad_id: 'b',
        nombre: 'Méndez, Pablo',
      },
    }
    expect(sustituirAlias('[DOCENTE:1], [DOCENTE:2]', porAlias)).toBe(
      '**Camila Navarro**, **Pablo Méndez**',
    )
  })
})

describe('orden de tablas', () => {
  const filas = [
    { nombre: 'b', monto: 10, alumno: '[ALUMNO:1]' },
    { nombre: 'a', monto: null, alumno: '[ALUMNO:2]' },
    { nombre: 'C', monto: 9, alumno: '[ALUMNO:3]' },
  ]

  it('rota asc, desc y sin orden', () => {
    const asc = siguienteOrden(null, 'monto')
    expect(asc).toEqual({ clave: 'monto', dir: 'asc' })
    expect(siguienteOrden(asc, 'monto')).toEqual({ clave: 'monto', dir: 'desc' })
    expect(siguienteOrden({ clave: 'monto', dir: 'desc' }, 'monto')).toBeNull()
    expect(siguienteOrden(asc, 'nombre')).toEqual({ clave: 'nombre', dir: 'asc' })
  })

  it('ordena los números como números y deja los vacíos al final', () => {
    const col = { clave: 'monto', etiqueta: 'Monto', tipo: 'moneda' } as const
    expect(ordenarFilas(filas, col, 'asc', {}).map((f) => f.monto)).toEqual([9, 10, null])
    expect(ordenarFilas(filas, col, 'desc', {}).map((f) => f.monto)).toEqual([10, 9, null])
  })

  it('ordena el texto sin distinguir mayúsculas y no muta la entrada', () => {
    const col = { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto' } as const
    expect(ordenarFilas(filas, col, 'asc', {}).map((f) => f.nombre)).toEqual(['a', 'b', 'C'])
    expect(filas.map((f) => f.nombre)).toEqual(['b', 'a', 'C'])
  })

  it('ordena los alias por el nombre resuelto', () => {
    const col = { clave: 'alumno', etiqueta: 'Alumno', tipo: 'alias' } as const
    const porAlias = {
      '[ALUMNO:1]': { alias: '[ALUMNO:1]', tipo: 'ALUMNO', entidad_id: 'x', nombre: 'Zeta, Ana' },
      '[ALUMNO:2]': { alias: '[ALUMNO:2]', tipo: 'ALUMNO', entidad_id: 'y', nombre: 'Alba, Eva' },
    } as const
    expect(ordenarFilas(filas.slice(0, 2), col, 'asc', porAlias).map((f) => f.alumno)).toEqual([
      '[ALUMNO:2]',
      '[ALUMNO:1]',
    ])
  })
})

describe('consultaDeMencion', () => {
  it('toma lo que sigue a la última arroba antes del cursor', () => {
    expect(consultaDeMencion('ficha de @mar', 13)).toBe('mar')
    expect(consultaDeMencion('@', 1)).toBe('')
    expect(consultaDeMencion('mail a@b', 8)).toBeNull()
    expect(consultaDeMencion('@mar listo', 10)).toBeNull()
  })
})

describe('consultaDeComando', () => {
  it('solo abre si el mensaje empieza con / y el cursor sigue en esa palabra', () => {
    expect(consultaDeComando('/', 1)).toBe('')
    expect(consultaDeComando('/deu', 4)).toBe('deu')
    expect(consultaDeComando('hola /deuda', 11)).toBeNull()
    expect(consultaDeComando('/deuda algo', 11)).toBeNull()
    expect(consultaDeComando('/a/b', 4)).toBeNull()
  })
})

describe('comandosDisponibles', () => {
  it('lista solo los atajos que el rol puede usar', () => {
    const nombres = (permisos: Permiso[], consulta = '') =>
      comandosDisponibles(permisos, consulta).map((c) => c.nombre)
    // Los modos sirven para cualquier módulo: se listan sin permisos propios.
    expect(nombres([])).toEqual(['comparar', 'grafico', 'resumen', 'ir', 'nueva'])
    expect(nombres([permiso('facturacion.leer')])).toEqual([
      'deuda',
      'comparar',
      'grafico',
      'resumen',
      'ir',
      'nueva',
    ])
  })

  it('filtra por lo escrito, sin distinguir tildes ni mayúsculas', () => {
    const todos = [permiso('facturacion.leer'), permiso('panel_administrativo.leer')]
    expect(comandosDisponibles(todos, 'EV').map((c) => c.nombre)).toEqual(['evolucion'])
    expect(comandosDisponibles(todos, 'zzz')).toEqual([])
  })
})

describe('resolverEnvio', () => {
  const comparar = COMANDOS.find((c) => c.nombre === 'comparar') ?? null
  const deuda = COMANDOS.find((c) => c.nombre === 'deuda') ?? null
  const nueva = COMANDOS.find((c) => c.nombre === 'nueva') ?? null

  it('con un atajo manda el texto escrito y su comando', () => {
    expect(resolverEnvio('asistencias de octubre', comparar)).toEqual({
      contenido: 'asistencias de octubre',
      comando: 'comparar',
    })
  })

  it('sin texto, un atajo de módulo manda su pregunta por defecto', () => {
    expect(resolverEnvio('  ', deuda)).toEqual({
      contenido: 'Familias con mayor deuda vencida',
      comando: 'deuda',
    })
  })

  it('un modo sin texto devuelve el contenido vacío', () => {
    expect(resolverEnvio('', comparar).contenido).toBe('')
  })

  it('sin atajo, o con uno local, no hay comando', () => {
    expect(resolverEnvio(' hola ', null)).toEqual({ contenido: 'hola', comando: null })
    expect(resolverEnvio('hola', nueva)).toEqual({ contenido: 'hola', comando: null })
  })
})

describe('atajoAlInicio', () => {
  it('reconoce un atajo escrito a mano y separa el resto', () => {
    const encontrado = atajoAlInicio('/grafico deuda de marzo', [])
    expect(encontrado?.comando.nombre).toBe('grafico')
    expect(encontrado?.resto).toBe('deuda de marzo')
  })

  it('ignora atajos desconocidos, locales o sin permiso', () => {
    expect(atajoAlInicio('/borrar algo', [])).toBeNull()
    expect(atajoAlInicio('/nueva algo', [])).toBeNull()
    expect(atajoAlInicio('/deuda algo', [])).toBeNull()
    expect(atajoAlInicio('hola /grafico', [])).toBeNull()
  })
})

describe('separarComando', () => {
  it('separa el atajo con el que se guardó el mensaje', () => {
    const { comando, texto } = separarComando('/comparar asistencias de octubre')
    expect(comando?.nombre).toBe('comparar')
    expect(texto).toBe('asistencias de octubre')
  })

  it('un atajo sin texto queda con el texto vacío', () => {
    expect(separarComando('/resumen').texto).toBe('')
  })

  it('un mensaje común, o con una barra que no es un atajo, queda igual', () => {
    expect(separarComando('hola /grafico')).toEqual({ comando: null, texto: 'hola /grafico' })
    expect(separarComando('/inventado algo')).toEqual({ comando: null, texto: '/inventado algo' })
    expect(separarComando('/nueva')).toEqual({ comando: null, texto: '/nueva' })
  })
})

describe('tonoDeKpi', () => {
  const kpi = { tipo: 'kpi', titulo: 'x', valor: 1, unidad: '', periodo: 'p', fuente: 'f' } as const

  it('es bueno si la variación va hacia donde es mejor', () => {
    expect(tonoDeKpi({ ...kpi, variacion: 5, mejora: 'alza' })).toBe('bueno')
    expect(tonoDeKpi({ ...kpi, variacion: -5, mejora: 'baja' })).toBe('bueno')
  })

  it('es malo si va al revés', () => {
    expect(tonoDeKpi({ ...kpi, variacion: -5, mejora: 'alza' })).toBe('malo')
    expect(tonoDeKpi({ ...kpi, variacion: 5, mejora: 'baja' })).toBe('malo')
  })

  it('es neutro sin variación, sin cambio o sin saber qué es mejor', () => {
    expect(tonoDeKpi({ ...kpi, mejora: 'alza' })).toBe('neutro')
    expect(tonoDeKpi({ ...kpi, variacion: null, mejora: 'alza' })).toBe('neutro')
    expect(tonoDeKpi({ ...kpi, variacion: 0, mejora: 'alza' })).toBe('neutro')
    expect(tonoDeKpi({ ...kpi, variacion: 5 })).toBe('neutro')
  })
})

describe('esColumnaDeCambio', () => {
  it('reconoce las columnas de variación y diferencia', () => {
    const columna = (clave: string) => ({ clave, etiqueta: clave, tipo: 'numero' as const })
    expect(esColumnaDeCambio(columna('variacion_facturado'))).toBe(true)
    expect(esColumnaDeCambio(columna('diferencia_presencia'))).toBe(true)
    expect(esColumnaDeCambio(columna('facturado'))).toBe(false)
  })
})

describe('iconoDeKpi', () => {
  const kpi = { tipo: 'kpi', titulo: 'x', valor: 1, unidad: '', periodo: 'p', fuente: 'f' } as const

  it('elige el ícono según de qué trata el indicador', () => {
    expect(iconoDeKpi({ ...kpi, titulo: 'Ausentes (total)' })).toBe('ausentes')
    expect(iconoDeKpi({ ...kpi, titulo: 'Inasistencias del día' })).toBe('ausentes')
    expect(iconoDeKpi({ ...kpi, titulo: 'Inscripciones (total)' })).toBe('inscripciones')
    expect(iconoDeKpi({ ...kpi, titulo: 'Alumnos activos' })).toBe('alumnos')
    expect(iconoDeKpi({ ...kpi, titulo: 'Tareas abiertas (todas)' })).toBe('tareas')
    expect(iconoDeKpi({ ...kpi, titulo: 'Solicitudes de compra pendientes' })).toBe('compras')
  })

  it('distingue la deuda del resto de los importes', () => {
    expect(iconoDeKpi({ ...kpi, titulo: 'Deuda vencida total', unidad: '$' })).toBe('deuda')
    expect(iconoDeKpi({ ...kpi, titulo: 'Facturado (total)', unidad: '$' })).toBe('dinero')
  })

  it('usa un ícono general si no reconoce el tema', () => {
    expect(iconoDeKpi({ ...kpi, titulo: 'Algo nuevo' })).toBe('general')
  })
})

describe('armarCopiaTabla', () => {
  const bloque: BloqueTabla = {
    tipo: 'tabla',
    tabla_id: 't',
    titulo: 'Deuda por familia',
    columnas: [
      { clave: 'familia', etiqueta: 'Familia', tipo: 'alias' },
      { clave: 'monto', etiqueta: 'Monto', tipo: 'moneda' },
    ],
    filas: [{ familia: '[FAMILIA:1]', monto: 1000 }],
    periodo: 'al 17/11/2026',
    fuente: 'Cuenta corriente',
  }

  it('trae solo el encabezado y las filas, con el nombre real en los alias', () => {
    const porAlias = {
      '[FAMILIA:1]': {
        alias: '[FAMILIA:1]',
        tipo: 'FAMILIA',
        entidad_id: 'f1',
        nombre: 'Pérez, Ana',
      },
    } as const
    const { texto, html } = armarCopiaTabla(bloque, porAlias)
    expect(texto.split('\n')).toHaveLength(2)
    expect(texto).toContain('Familia\tMonto')
    expect(texto).toContain('Pérez, Ana')
    expect(texto).not.toContain('Deuda por familia')
    expect(texto).not.toContain('Cuenta corriente')
    expect(html.startsWith('<table>')).toBe(true)
  })
})
