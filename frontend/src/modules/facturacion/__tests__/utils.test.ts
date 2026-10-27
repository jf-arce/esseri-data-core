import { describe, expect, it } from 'vitest'
import {
  etiquetaEstadoFactura,
  etiquetaMetodoPago,
  fechaApi,
  formatearFechaFactura,
  formatearMoneda,
  resumenConceptosFactura,
  validarTramoPenalidad,
} from '@/modules/facturacion/utils'

describe('utilidades de facturación', () => {
  it('formatea fechas, importes y estados para la interfaz', () => {
    expect(formatearFechaFactura('2027-03-01')).toBe('01/03/2027')
    expect(formatearMoneda('120000')).toContain('120.000,00')
    expect(etiquetaEstadoFactura('pendiente')).toBe('Pendiente')
    expect(etiquetaMetodoPago('debito_directo')).toBe('Débito directo')
    expect(etiquetaMetodoPago('tarjeta_credito')).toBe('Tarjeta de crédito')
    expect(
      resumenConceptosFactura([
        {
          id: '1',
          concepto_cobro_id: 'cuota',
          monto: '1',
          descripcion: 'DEMO · Cuota educativa mensual · 08/2026',
        },
        { id: '2', concepto_cobro_id: 'comedor', monto: '1', descripcion: 'Comedor agosto' },
      ]),
    ).toBe('Cuota educativa mensual + 1 más')
  })

  it('convierte una fecha local al formato del backend', () => {
    expect(fechaApi(new Date(2027, 2, 1))).toBe('2027-03-01')
  })
})

describe('validarTramoPenalidad', () => {
  const valido = { desde: '6', hasta: '15', porcentaje: '20', conceptoId: 'concepto-1' }

  it('acepta un tramo completo y uno sin límite superior', () => {
    expect(validarTramoPenalidad(valido)).toBeNull()
    expect(validarTramoPenalidad({ ...valido, hasta: '' })).toBeNull()
  })

  it('rechaza datos faltantes, rangos invertidos y porcentajes fuera de rango', () => {
    expect(validarTramoPenalidad({ ...valido, conceptoId: '' })).toMatch(/Completá/)
    expect(validarTramoPenalidad({ ...valido, hasta: '5' })).toMatch(/día hasta/)
    expect(validarTramoPenalidad({ ...valido, desde: '2.5' })).toMatch(/día desde/)
    expect(validarTramoPenalidad({ ...valido, porcentaje: '120' })).toMatch(/entre 0 y 100/)
  })
})
