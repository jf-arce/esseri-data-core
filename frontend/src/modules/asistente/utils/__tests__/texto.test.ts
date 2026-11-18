import { describe, expect, it } from 'vitest'
import { cortarSeguro } from '../texto'

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
