import { describe, expect, it } from 'vitest'
import {
  etiquetaEstadoFactura,
  fechaApi,
  formatearFechaFactura,
  formatearMoneda,
} from '@/modules/facturacion/utils'

describe('utilidades de facturación', () => {
  it('formatea fechas, importes y estados para la interfaz', () => {
    expect(formatearFechaFactura('2027-03-01')).toBe('01/03/2027')
    expect(formatearMoneda('120000')).toContain('120.000,00')
    expect(etiquetaEstadoFactura('pendiente')).toBe('Pendiente')
  })

  it('convierte una fecha local al formato del backend', () => {
    expect(fechaApi(new Date(2027, 2, 1))).toBe('2027-03-01')
  })
})
