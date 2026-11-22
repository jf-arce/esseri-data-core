import { describe, expect, it } from 'vitest'
import { normalizarTexto } from '../texto'

describe('normalizarTexto', () => {
  it('ignora mayúsculas, tildes y eñe', () => {
    expect(normalizarTexto('  INÉS  ')).toBe('ines')
    expect(normalizarTexto('Peña')).toBe('pena')
    expect(normalizarTexto('Ñandú')).toBe('nandu')
  })

  it('ignora el signo de grado y colapsa espacios', () => {
    expect(normalizarTexto('3°C   Aula')).toBe('3c aula')
  })
})
