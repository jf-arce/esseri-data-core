import { describe, expect, it } from 'vitest'
import { cn } from '../utils'

describe('cn con utilidades del Portal Familia', () => {
  it('conserva el tamaño propio junto a un color de texto', () => {
    expect(cn('text-pf-cuerpo', 'text-texto')).toBe('text-pf-cuerpo text-texto')
  })

  it('resuelve el conflicto entre tamaños', () => {
    expect(cn('text-sm', 'text-pf-cuerpo')).toBe('text-pf-cuerpo')
  })

  it('reemplaza el radio y la sombra base por los del portal', () => {
    expect(cn('rounded-card shadow-card', 'rounded-pf-card shadow-pf-card')).toBe(
      'rounded-pf-card shadow-pf-card',
    )
  })
})
