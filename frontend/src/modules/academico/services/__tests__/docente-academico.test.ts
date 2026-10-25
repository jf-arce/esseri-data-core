import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import {
  listarAlumnosDivisionDocente,
  obtenerPerfilDocenteActual,
  obtenerSeguimientoDivisionDocente,
} from '../docente-academico'

vi.mock('@/api/client', () => ({ apiClient: vi.fn() }))

const mockedApiClient = vi.mocked(apiClient)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('servicios del Portal Docente', () => {
  it('consulta solo el nombre del docente autenticado', async () => {
    mockedApiClient.mockResolvedValue({ nombre: 'Julieta', apellido: 'Amaya' })

    await obtenerPerfilDocenteActual()

    expect(mockedApiClient).toHaveBeenCalledWith('/academico/docentes/me/perfil')
  })

  it('consulta el roster autorizado del curso y ciclo elegidos', async () => {
    mockedApiClient.mockResolvedValue({
      items: [],
      total: 0,
      pagina: 1,
      tamanio_pagina: 100,
      total_paginas: 0,
    })

    await listarAlumnosDivisionDocente('division-1', '2027')

    expect(mockedApiClient).toHaveBeenCalledWith(
      '/academico/docentes/me/divisiones/division-1/alumnos?ciclo_lectivo=2027',
    )
  })

  it('consulta seguimiento sin crear una alerta o cambiar asistencias', async () => {
    mockedApiClient.mockResolvedValue([])

    await obtenerSeguimientoDivisionDocente('division-1', '2027')

    expect(mockedApiClient).toHaveBeenCalledWith(
      '/academico/docentes/me/divisiones/division-1/seguimiento?ciclo_lectivo=2027',
    )
  })
})
