import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import { UsuarioEdicionPage } from '@/modules/auth/pages/usuario-edicion-page'
import { actualizarAccesoUsuario } from '@/modules/auth/services/actualizar-acceso-usuario'
import { actualizarUsuario } from '@/modules/auth/services/actualizar-usuario'
import { getUsuario } from '@/modules/auth/services/get-usuario'
import type { UsuarioDetalle } from '@/modules/auth/types'

vi.mock('@/modules/auth/services/get-usuario')
vi.mock('@/modules/auth/services/actualizar-usuario')
vi.mock('@/modules/auth/services/actualizar-acceso-usuario')

const navigateMock = vi.fn()
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router')
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useParams: () => ({ usuarioId: 'u1' }),
  }
})

const mockedGetUsuario = vi.mocked(getUsuario)
const mockedActualizarUsuario = vi.mocked(actualizarUsuario)
const mockedActualizarAccesoUsuario = vi.mocked(actualizarAccesoUsuario)

const usuarioDetalle: UsuarioDetalle = {
  id: 'u1',
  email: 'ana@esseri.edu.ar',
  estado: 'activo',
  auth_provider: 'local',
  ultimo_acceso: null,
  roles: [],
  persona_id: 'p1',
  persona_nombre: 'Ana',
  persona_apellido: 'Pérez',
  persona_dni: '30111222',
  persona_telefono: '1155554444',
}

function renderPagina() {
  return render(
    <MemoryRouter>
      <UsuarioEdicionPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedGetUsuario.mockResolvedValue(usuarioDetalle)
})

describe('UsuarioEdicionPage', () => {
  it('precarga los datos de la persona y el email', async () => {
    renderPagina()

    expect(await screen.findByDisplayValue('Ana')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Pérez')).toBeInTheDocument()
    expect(screen.getByDisplayValue('30111222')).toBeInTheDocument()
    expect(screen.getByDisplayValue('1155554444')).toBeInTheDocument()
    expect(screen.getByDisplayValue('ana@esseri.edu.ar')).toBeInTheDocument()
  })

  it('manda solo el email cuando solo cambió el email', async () => {
    const user = userEvent.setup()
    mockedActualizarUsuario.mockResolvedValue(usuarioDetalle)
    renderPagina()

    const email = await screen.findByLabelText(/correo/i)
    await user.clear(email)
    await user.type(email, 'nueva@esseri.edu.ar')
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }))

    await waitFor(() => expect(mockedActualizarUsuario).toHaveBeenCalledTimes(1))
    expect(mockedActualizarUsuario).toHaveBeenCalledWith('u1', {
      email: 'nueva@esseri.edu.ar',
      persona: { nombre: 'Ana', apellido: 'Pérez', dni: '30111222', telefono: '1155554444' },
    })
  })

  it('muestra el error de la API si falla el guardado de datos', async () => {
    const user = userEvent.setup()
    mockedActualizarUsuario.mockRejectedValue(new ApiError(409, 'Ese email ya está registrado'))
    renderPagina()

    await screen.findByDisplayValue('Ana')
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }))

    expect(await screen.findByText('Ese email ya está registrado')).toBeInTheDocument()
  })

  it('actualiza el acceso a Google', async () => {
    const user = userEvent.setup()
    mockedActualizarAccesoUsuario.mockResolvedValue(undefined)
    renderPagina()

    await screen.findByDisplayValue('Ana')
    await user.click(screen.getByLabelText(/google/i))
    await user.click(screen.getByRole('button', { name: /actualizar acceso/i }))

    await waitFor(() => expect(mockedActualizarAccesoUsuario).toHaveBeenCalledTimes(1))
    expect(mockedActualizarAccesoUsuario).toHaveBeenCalledWith('u1', { metodo: 'google' })
  })

  it('exige una contraseña de al menos 12 caracteres para resetearla', async () => {
    const user = userEvent.setup()
    renderPagina()

    await screen.findByDisplayValue('Ana')
    await user.type(screen.getByLabelText(/nueva contraseña/i), 'corta')
    await user.click(screen.getByRole('button', { name: /actualizar acceso/i }))

    expect(await screen.findByText(/al menos 12 caracteres/i)).toBeInTheDocument()
    expect(mockedActualizarAccesoUsuario).not.toHaveBeenCalled()
  })
})
