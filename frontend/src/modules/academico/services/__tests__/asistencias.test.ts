import { beforeEach, describe, expect, it, vi } from 'vitest'
import { descargarExport } from '@/lib/descargar-export'
import { exportarAsistencias } from '@/modules/academico/services/asistencias'

vi.mock('@/lib/descargar-export')

const mockedDescargarExport = vi.mocked(descargarExport)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('exportarAsistencias', () => {
  it('arma la query sin division_id cuando no se elige ninguna', async () => {
    mockedDescargarExport.mockResolvedValue(undefined)

    await exportarAsistencias({
      fecha_desde: '2027-03-01',
      fecha_hasta: '2027-03-31',
      formato: 'csv',
    })

    expect(mockedDescargarExport).toHaveBeenCalledWith(
      '/academico/asistencias/exportar?fecha_desde=2027-03-01&fecha_hasta=2027-03-31&formato=csv',
      'asistencias_2027-03-01_2027-03-31.csv',
    )
  })

  it('incluye division_id cuando se elige una división puntual', async () => {
    mockedDescargarExport.mockResolvedValue(undefined)

    await exportarAsistencias({
      fecha_desde: '2027-03-01',
      fecha_hasta: '2027-03-31',
      formato: 'xlsx',
      division_id: 'division-1',
    })

    expect(mockedDescargarExport).toHaveBeenCalledWith(
      '/academico/asistencias/exportar?fecha_desde=2027-03-01&fecha_hasta=2027-03-31&formato=xlsx&division_id=division-1',
      'asistencias_2027-03-01_2027-03-31.xlsx',
    )
  })
})
