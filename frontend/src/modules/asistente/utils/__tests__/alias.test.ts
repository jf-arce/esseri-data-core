import { describe, expect, it } from 'vitest'
import type { MensajeVisible } from '../../types'
import {
  aliasDeMensajes,
  nombreCorrido,
  etiquetaGenerica,
  partirTextoConAlias,
  sustituirAlias,
} from '../alias'
import { rutaDeEntidad } from '../destinos'

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
