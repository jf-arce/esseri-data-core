import { afterEach, describe, expect, it, vi } from 'vitest'
import { descargarExport } from '@/lib/descargar-export'
import { exportarInscripciones } from '@/modules/inscripciones/services/exportar-inscripciones'

vi.mock('@/lib/descargar-export')

const mockedDescargarExport = vi.mocked(descargarExport)

describe('exportarInscripciones', () => {
  afterEach(() => vi.clearAllMocks())

  it('envía los filtros del listado al endpoint CSV', async () => {
    await exportarInscripciones({
      buscar: 'Pérez 10',
      cicloLectivo: '2027',
      estado: 'activa',
      tipo: 'reinscripcion',
      ordenarPor: 'alumno',
      direccion: 'asc',
    })

    expect(mockedDescargarExport).toHaveBeenCalledWith(
      '/inscripciones/exportar?buscar=P%C3%A9rez+10&ciclo_lectivo=2027&estado=activa&tipo=reinscripcion&ordenar_por=alumno&direccion=asc',
      'inscripciones.csv',
    )
  })

  it('no agrega un signo de pregunta cuando no hay filtros', async () => {
    await exportarInscripciones({})

    expect(mockedDescargarExport).toHaveBeenCalledWith(
      '/inscripciones/exportar',
      'inscripciones.csv',
    )
  })
})
