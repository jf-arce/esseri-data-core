import { describe, expect, it } from 'vitest'
import { normalizarTexto } from '../utils'

describe('normalizarTexto', () => {
  it('ignora mayúsculas, acentos y espacios sobrantes', () => {
    expect(normalizarTexto('  JOSÉ  ')).toBe('jose')
    expect(normalizarTexto('Matemática')).toBe('matematica')
    expect(normalizarTexto('  Nivel   Primario ')).toBe('nivel primario')
  })

  it('quita el signo de grado para poder buscar "3c"', () => {
    expect(normalizarTexto('3°C')).toBe('3c')
    expect(normalizarTexto('3ºC')).toBe('3c')
  })
})
