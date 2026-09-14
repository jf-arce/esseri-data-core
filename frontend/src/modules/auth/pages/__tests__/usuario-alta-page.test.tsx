import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import { crearAltaDocente } from '@/modules/academico/services/docentes'
import { UsuarioAltaPage } from '@/modules/auth/pages/usuario-alta-page'
import { crearUsuario } from '@/modules/auth/services/crear-usuario'
import { getRoles } from '@/modules/auth/services/get-roles'
import type { Rol } from '@/modules/auth/types'

vi.mock('@/modules/auth/services/get-roles')
vi.mock('@/modules/auth/services/crear-usuario')
vi.mock('@/modules/academico/services/docentes')

const navigateMock = vi.fn()
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router')
  return { ...actual, useNavigate: () => navigateMock }
})

const mockedGetRoles = vi.mocked(getRoles)
const mockedCrearUsuario = vi.mocked(crearUsuario)
const mockedCrearAltaDocente = vi.mocked(crearAltaDocente)

const rolCompras: Rol = { id: 'r-compras', codigo: 'compras', nombre: 'Compras', descripcion: null }
const rolFamilia: Rol = { id: 'r-familia', codigo: 'familia', nombre: 'Familia', descripcion: null }
const rolDocente: Rol = { id: 'r-docente', codigo: 'docente', nombre: 'Docente', descripcion: null }

function renderPagina() {
  return render(
    <MemoryRouter>
      <UsuarioAltaPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedGetRoles.mockResolvedValue([rolCompras, rolFamilia, rolDocente])
})

describe('UsuarioAltaPage', () => {
  it('no ofrece familia ni docente entre los roles asignables de "personal"', async () => {
    renderPagina()

    await waitFor(() => expect(screen.getByText('Compras')).toBeInTheDocument())
    // "Familia"/"Docente" siguen apareciendo como tipo de cuenta (radios) — lo que no debe
    // pasar es que además aparezcan como checkbox de rol asignable.
    expect(screen.getAllByText('Familia')).toHaveLength(1)
    expect(screen.getAllByText('Docente')).toHaveLength(1)
  })

  it('elegir "familia" ofrece ir al alta de familia en vez de un formulario', async () => {
    const user = userEvent.setup()
    renderPagina()

    await user.click(screen.getByLabelText(/familia/i))

    expect(screen.getByText(/el alta de familia usa su propio formulario/i)).toBeInTheDocument()
    expect(screen.queryByLabelText('DNI')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /ir al alta de familia/i }))
    expect(navigateMock).toHaveBeenCalledWith('/familias-alumnos/nueva-familia')
  })

  it('elegir "docente" pide legajo en vez de roles y envía el alta de docente', async () => {
    const user = userEvent.setup()
    mockedCrearAltaDocente.mockResolvedValue({
      id: 'd1',
      legajo: 'DOC-1',
      persona_id: 'p1',
      created_at: '',
      updated_at: '',
    })
    renderPagina()

    await user.click(screen.getByLabelText(/^docente$/i))
    await user.type(screen.getByLabelText(/nombre/i), 'Marta')
    await user.type(screen.getByLabelText(/apellido/i), 'Ríos')
    await user.type(screen.getByLabelText(/dni/i), '30111222')
    await user.type(screen.getByLabelText(/correo/i), 'marta@esseri.edu.ar')
    await user.type(
      screen.getByLabelText(/contraseña inicial/i, { selector: 'input[type="password"]' }),
      'una-contrasenia-larga',
    )
    await user.type(screen.getByLabelText(/legajo/i), 'DOC-1')

    await user.click(screen.getByRole('button', { name: /crear docente/i }))

    await waitFor(() => expect(mockedCrearAltaDocente).toHaveBeenCalledTimes(1))
    expect(mockedCrearAltaDocente).toHaveBeenCalledWith({
      persona: { nombre: 'Marta', apellido: 'Ríos', dni: '30111222', telefono: null },
      acceso: { email: 'marta@esseri.edu.ar', metodo: 'local', password: 'una-contrasenia-larga' },
      legajo: 'DOC-1',
    })
    expect(navigateMock).toHaveBeenCalledWith('/academico/docentes')
  })

  it('acceso por Google no pide ni envía contraseña', async () => {
    const user = userEvent.setup()
    mockedCrearUsuario.mockResolvedValue({
      id: 'u1',
      email: 'nueva@esseri.edu.ar',
      estado: 'activo',
      auth_provider: 'google',
      ultimo_acceso: null,
      roles: [rolCompras],
      persona_id: 'p1',
      persona_nombre: 'Ana',
      persona_apellido: 'Pérez',
    })
    renderPagina()

    await waitFor(() => expect(screen.getByText('Compras')).toBeInTheDocument())
    await user.type(screen.getByLabelText(/nombre/i), 'Ana')
    await user.type(screen.getByLabelText(/apellido/i), 'Pérez')
    await user.type(screen.getByLabelText(/dni/i), '30111222')
    await user.type(screen.getByLabelText(/correo/i), 'nueva@esseri.edu.ar')
    await user.click(screen.getByLabelText(/google/i))
    expect(
      screen.queryByLabelText(/contraseña inicial/i, { selector: 'input[type="password"]' }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByText('Compras'))

    await user.click(screen.getByRole('button', { name: /crear usuario/i }))

    await waitFor(() => expect(mockedCrearUsuario).toHaveBeenCalledTimes(1))
    expect(mockedCrearUsuario).toHaveBeenCalledWith({
      persona: { nombre: 'Ana', apellido: 'Pérez', dni: '30111222', telefono: null },
      acceso: { email: 'nueva@esseri.edu.ar', metodo: 'google' },
      rol_ids: ['r-compras'],
    })
    expect(navigateMock).toHaveBeenCalledWith('/usuarios-roles/usuarios')
  })

  it('muestra el error del backend sin navegar si el alta falla', async () => {
    const user = userEvent.setup()
    mockedCrearUsuario.mockRejectedValue(new ApiError(409, 'Ese email ya está registrado'))
    renderPagina()

    await waitFor(() => expect(screen.getByText('Compras')).toBeInTheDocument())
    await user.type(screen.getByLabelText(/nombre/i), 'Ana')
    await user.type(screen.getByLabelText(/apellido/i), 'Pérez')
    await user.type(screen.getByLabelText(/dni/i), '30111222')
    await user.type(screen.getByLabelText(/correo/i), 'repetido@esseri.edu.ar')
    await user.type(
      screen.getByLabelText(/contraseña inicial/i, { selector: 'input[type="password"]' }),
      'una-contrasenia-larga',
    )
    await user.click(screen.getByText('Compras'))

    await user.click(screen.getByRole('button', { name: /crear usuario/i }))

    await waitFor(() =>
      expect(screen.getByText('Ese email ya está registrado')).toBeInTheDocument(),
    )
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
