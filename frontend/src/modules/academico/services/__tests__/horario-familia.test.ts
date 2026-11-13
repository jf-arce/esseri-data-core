import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import { getHorarioFamilia } from '@/modules/academico/services/horario-familia'

vi.mock('@/api/client', () => ({ apiClient: vi.fn() }))

const mockedApiClient = vi.mocked(apiClient)

beforeEach(() => {
  vi.clearAllMocks()
  mockedApiClient.mockResolvedValue([])
})

describe('horario de familia', () => {
  it('pide el horario del alumno en la ruta familiar', async () => {
    const signal = new AbortController().signal

    await getHorarioFamilia('alumno-1', signal)

    expect(mockedApiClient).toHaveBeenCalledWith('/academico/familia/alumnos/alumno-1/horario', {
      signal,
    })
  })
})
