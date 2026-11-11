import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import { useGuardarFranjas } from '../use-guardar-franjas'
import type { MateriaCurso } from '../../types'

const { actualizar, toastError } = vi.hoisted(() => ({
  actualizar: vi.fn(),
  toastError: vi.fn(),
}))
vi.mock('@/modules/academico/services/materias-curso', () => ({
  actualizarMateriaCurso: actualizar,
}))
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }))

const materia = {
  id: 'mc1',
  horarios: [
    { id: 'h1', dia_semana: 1, hora_inicio: '08:00:00', hora_fin: '09:00:00' },
    { id: 'h2', dia_semana: 3, hora_inicio: '10:00:00', hora_fin: '11:00:00' },
  ],
} as MateriaCurso

const destino = { dia_semana: 2, hora_inicio: '09:00', hora_fin: '10:00' }

describe('useGuardarFranjas', () => {
  beforeEach(() => vi.clearAllMocks())

  it('aplica el cambio al instante, reenvía todas las franjas y avisa al terminar', async () => {
    actualizar.mockResolvedValue(materia)
    const onGuardado = vi.fn()
    const { result } = renderHook(() => useGuardarFranjas([materia], onGuardado))

    let promesa: Promise<void> = Promise.resolve()
    act(() => {
      promesa = result.current.guardar('mc1', 'h1', destino)
    })
    expect(result.current.materiasCurso[0].horarios[0]).toMatchObject(destino)
    expect(result.current.estaGuardando('mc1')).toBe(true)

    await act(async () => {
      await promesa
    })
    expect(actualizar).toHaveBeenCalledWith('mc1', {
      horarios: [destino, { dia_semana: 3, hora_inicio: '10:00', hora_fin: '11:00' }],
    })
    expect(onGuardado).toHaveBeenCalledTimes(1)
    expect(result.current.estaGuardando('mc1')).toBe(false)
  })

  it('revierte y muestra el detalle del error', async () => {
    actualizar.mockRejectedValue(new ApiError(409, 'El docente ya tiene clase en ese horario.'))
    const onGuardado = vi.fn()
    const { result } = renderHook(() => useGuardarFranjas([materia], onGuardado))

    await act(async () => {
      await result.current.guardar('mc1', 'h1', destino)
    })
    expect(result.current.materiasCurso[0].horarios[0].dia_semana).toBe(1)
    expect(result.current.hayPendientes).toBe(false)
    expect(toastError).toHaveBeenCalledWith('El docente ya tiene clase en ese horario.')
    expect(onGuardado).not.toHaveBeenCalled()
  })
})
