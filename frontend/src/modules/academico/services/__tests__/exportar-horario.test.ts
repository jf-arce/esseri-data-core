import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as exportacion from '@/lib/descargar-export'
import {
  compartirHorarioDivision,
  descargarHorarioDivision,
} from '@/modules/academico/services/exportar-horario'

vi.mock('@/lib/descargar-export')

const blob = new Blob(['x'])

describe('exportar horario de una división', () => {
  beforeEach(() => {
    vi.mocked(exportacion.obtenerExport).mockResolvedValue({
      blob,
      nombre: 'horario_semanal_nivel_primario_4b_2026.xlsx',
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('descarga el archivo que arma el backend', async () => {
    await descargarHorarioDivision('d-1')

    expect(exportacion.obtenerExport).toHaveBeenCalledWith(
      '/academico/divisiones/d-1/horario/exportar',
      'horario_semanal.xlsx',
    )
    expect(exportacion.guardarArchivo).toHaveBeenCalledWith(
      blob,
      'horario_semanal_nivel_primario_4b_2026.xlsx',
    )
  })

  it('comparte el archivo si el navegador puede', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { canShare: () => true, share })

    await compartirHorarioDivision('d-1', 'Horario de 4°B')

    expect(share).toHaveBeenCalledOnce()
    expect(exportacion.guardarArchivo).not.toHaveBeenCalled()
  })

  it('descarga si el navegador no puede compartir archivos', async () => {
    vi.stubGlobal('navigator', { canShare: () => false, share: vi.fn() })

    await compartirHorarioDivision('d-1', 'Horario de 4°B')

    expect(exportacion.guardarArchivo).toHaveBeenCalledWith(
      blob,
      'horario_semanal_nivel_primario_4b_2026.xlsx',
    )
  })

  it('no falla si la persona cierra el menú de compartir', async () => {
    const cancelado = new DOMException('cancelado', 'AbortError')
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: vi.fn().mockRejectedValue(cancelado),
    })

    await expect(compartirHorarioDivision('d-1', 'Horario')).resolves.toBeUndefined()
  })
})
