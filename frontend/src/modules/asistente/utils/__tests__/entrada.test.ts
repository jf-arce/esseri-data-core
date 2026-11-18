import { describe, expect, it } from 'vitest'
import type { Permiso } from '@/modules/auth/types'
import { COMANDOS } from '../../constants'
import {
  atajoAlInicio,
  prepararEdicion,
  separarComando,
  comandosDisponibles,
  consultaDeComando,
  coincideConBusqueda,
  consultaDeMencion,
  sugerenciasPermitidas,
  resolverEnvio,
} from '../entrada'
import { permiso } from './auxiliares'

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

describe('prepararEdicion', () => {
  const porAlias = {
    '[ALUMNO:1]': {
      alias: '[ALUMNO:1]',
      tipo: 'ALUMNO' as const,
      entidad_id: 'a1',
      nombre: 'Mariana Quintero',
    },
  }

  it('pone @Nombre donde había un alias y reconstruye la mención', () => {
    const { texto, menciones, comando } = prepararEdicion('asistencia de [ALUMNO:1]', porAlias)
    expect(comando).toBeNull()
    expect(texto).toBe('asistencia de @Mariana Quintero')
    expect(menciones).toEqual([{ tipo: 'ALUMNO', entidad_id: 'a1', texto: '@Mariana Quintero' }])
  })

  it('mantiene el atajo aparte del texto y deja sin tocar un alias que no conoce', () => {
    const { texto, menciones, comando } = prepararEdicion('/grafico de [ALUMNO:9]', porAlias)
    expect(comando?.nombre).toBe('grafico')
    expect(texto).toBe('de [ALUMNO:9]')
    expect(menciones).toEqual([])
  })
})
