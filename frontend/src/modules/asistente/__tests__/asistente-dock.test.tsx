import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/store/auth-store'

const montajes = vi.fn()
vi.mock('../components/asistente-panel', async () => {
  const { useEffect } = await import('react')
  return {
    AsistentePanel: () => {
      useEffect(() => {
        montajes()
      }, [])
      return <div>panel</div>
    },
  }
})

import { AsistenteDock } from '../components/asistente-dock'

beforeEach(() => {
  montajes.mockClear()
  useAuthStore.setState({ usuario: null, rolActivo: 'direccion' })
})

it('remonta el panel (y descarta su estado) al cambiar de rol', () => {
  render(
    <MemoryRouter>
      <AsistenteDock />
    </MemoryRouter>,
  )
  expect(screen.getByText('panel')).toBeInTheDocument()
  expect(montajes).toHaveBeenCalledTimes(1)

  act(() => useAuthStore.setState({ rolActivo: 'administracion' }))

  expect(montajes).toHaveBeenCalledTimes(2)
})
