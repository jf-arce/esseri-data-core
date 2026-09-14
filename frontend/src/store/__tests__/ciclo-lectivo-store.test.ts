import { beforeEach, describe, expect, it } from 'vitest'
import { useCicloLectivoStore } from '@/store/ciclo-lectivo-store'

beforeEach(() => {
  useCicloLectivoStore.setState({ cicloLectivo: '2026' })
})

describe('useCicloLectivoStore', () => {
  it('inicia en el ciclo disponible más reciente', () => {
    expect(useCicloLectivoStore.getState().cicloLectivo).toBe('2026')
  })

  it('actualiza el ciclo compartido', () => {
    useCicloLectivoStore.getState().setCicloLectivo('2025')

    expect(useCicloLectivoStore.getState().cicloLectivo).toBe('2025')
  })
})
