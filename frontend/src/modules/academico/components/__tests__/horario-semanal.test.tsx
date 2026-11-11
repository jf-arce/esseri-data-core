import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HorarioSemanal } from '../horario-semanal'
import type { MateriaCurso } from '../../types'

const { actualizar } = vi.hoisted(() => ({ actualizar: vi.fn() }))
vi.mock('@/modules/academico/services/materias-curso', () => ({
  actualizarMateriaCurso: actualizar,
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const lengua = {
  id: 'mc1',
  materia_nombre: 'Lengua',
  materia_tipo: 'materia',
  materia_color: '#2563eb',
  horarios: [{ id: 'h1', dia_semana: 2, hora_inicio: '08:00:00', hora_fin: '09:00:00' }],
} as MateriaCurso

describe('HorarioSemanal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    actualizar.mockResolvedValue(lengua)
  })
  afterEach(() => vi.useRealTimers())

  it('mueve la franja con las flechas y guarda tras una pausa', async () => {
    const onGuardado = vi.fn()
    render(
      <HorarioSemanal
        materiasCurso={[lengua]}
        asignacionesDe={() => []}
        puedeEditar
        onEditar={vi.fn()}
        onEliminar={vi.fn()}
        onAgregar={vi.fn()}
        onGuardado={onGuardado}
        resaltadas={[]}
        onAlternarResaltada={vi.fn()}
        onQuitarResaltado={vi.fn()}
      />,
    )
    const bloque = screen.getByRole('button', { name: /^Lengua, martes de 08:00 a 09:00/ })
    fireEvent.keyDown(bloque, { key: 'ArrowDown' })
    fireEvent.keyDown(bloque, { key: 'ArrowRight' })
    expect(actualizar).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    expect(actualizar).toHaveBeenCalledTimes(1)
    expect(actualizar).toHaveBeenCalledWith('mc1', {
      horarios: [{ dia_semana: 3, hora_inicio: '08:30', hora_fin: '09:30' }],
    })
    expect(onGuardado).toHaveBeenCalled()
  })

  it('Escape cancela la vista previa sin guardar', async () => {
    render(
      <HorarioSemanal
        materiasCurso={[lengua]}
        asignacionesDe={() => []}
        puedeEditar
        onEditar={vi.fn()}
        onEliminar={vi.fn()}
        onAgregar={vi.fn()}
        onGuardado={vi.fn()}
        resaltadas={[]}
        onAlternarResaltada={vi.fn()}
        onQuitarResaltado={vi.fn()}
      />,
    )
    const bloque = screen.getByRole('button', { name: /^Lengua, / })
    fireEvent.keyDown(bloque, { key: 'ArrowDown' })
    fireEvent.keyDown(bloque, { key: 'Escape' })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(actualizar).not.toHaveBeenCalled()
  })
})
