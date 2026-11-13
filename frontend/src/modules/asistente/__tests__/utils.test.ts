import { describe, expect, it } from 'vitest'
import type { Permiso } from '@/modules/auth/types'
import type { MensajeVisible } from '../types'
import {
  aliasDeMensajes,
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
