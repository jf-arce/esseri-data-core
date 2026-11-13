import { describe, expect, it } from 'vitest'
import type { Permiso } from '@/modules/auth/types'
import type { MensajeVisible } from '../types'
import {
  aliasDeMensajes,
  etiquetaDeDestino,
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
      'Mirá a [Quintero, Mariana](/familias-alumnos/alumnos/abc).',
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
      'Da **Ferrero, Graciela**',
    )
  })
})

describe('etiquetaDeDestino', () => {
  it('una clave desconocida no tiene etiqueta', () => {
    expect(etiquetaDeDestino('no_existe', null, [])).toBeNull()
  })
})
