import { describe, expect, it } from 'vitest'
import { parsearSse } from '../sse'

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
