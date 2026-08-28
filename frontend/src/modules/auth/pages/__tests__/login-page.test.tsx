import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import { LoginPage } from '@/modules/auth/pages/login-page'
import { getMe } from '@/modules/auth/services/get-me'
import { loginLocal } from '@/modules/auth/services/login-local'
import { useAuthStore } from '@/store/auth-store'

vi.mock('@/modules/auth/services/login-local')
vi.mock('@/modules/auth/services/get-me')

const mockedLoginLocal = vi.mocked(loginLocal)
const mockedGetMe = vi.mocked(getMe)

function renderLogin(ruta = '/login') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <LoginPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useAuthStore.setState({ usuario: null, status: 'idle' })
  vi.clearAllMocks()
})

describe('LoginPage', () => {
  it('muestra el mensaje de error cuando vuelve ?error=no_habilitado del callback de Google', () => {
    renderLogin('/login?error=no_habilitado')

    expect(screen.getByRole('alert')).toHaveTextContent('no está habilitada en ESSERI')
  })

  it('el botón de Google es un link a /auth/google/login, no un botón con onClick', () => {
    renderLogin()

    const link = screen.getByRole('link', { name: /continuar con google/i })
    expect(link).toHaveAttribute('href', expect.stringContaining('/auth/google/login'))
  })

  it('en login local exitoso, guarda el usuario en el store y navega', async () => {
    const usuario = {
      id: 'u1',
      email: 'a@esseri.edu.ar',
      auth_provider: 'local',
      estado: 'activo',
      roles: ['docente'],
      permisos: [],
    }
    mockedLoginLocal.mockResolvedValueOnce({ detail: 'Sesión iniciada' })
    mockedGetMe.mockResolvedValueOnce(usuario)

    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText(/correo institucional/i), 'a@esseri.edu.ar')
    await user.type(screen.getByLabelText(/^contraseña$/i), 'secreta123')
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    expect(mockedLoginLocal).toHaveBeenCalledWith('a@esseri.edu.ar', 'secreta123')
    await vi.waitFor(() => expect(mockedGetMe).toHaveBeenCalled())
    expect(useAuthStore.getState().usuario).toEqual(usuario)
    expect(useAuthStore.getState().status).toBe('authenticated')
  })

  it('en error de credenciales, muestra el detail del backend sin loguear', async () => {
    mockedLoginLocal.mockRejectedValueOnce(new ApiError(401, 'Credenciales inválidas'))

    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText(/correo institucional/i), 'a@esseri.edu.ar')
    await user.type(screen.getByLabelText(/^contraseña$/i), 'mala')
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales inválidas')
    expect(useAuthStore.getState().status).toBe('idle')
  })
})
