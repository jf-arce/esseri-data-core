import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DestinatariosCampos } from '@/modules/workflows/components/destinatarios-campos'
import { useAuthStore } from '@/store/auth-store'
import type { Rol, UsuarioConRoles } from '@/modules/auth/types'

const rol = { id: 'r-1', nombre: 'direccion' } as Rol
const admin = {
  id: 'u-1',
  email: 'tareas.admin@esseri.local',
  estado: 'activo',
  persona_nombre: null,
  persona_apellido: null,
} as unknown as UsuarioConRoles
const secretaria = {
  id: 'u-2',
  email: 'ana.perez@esseri.edu.ar',
  estado: 'activo',
  persona_nombre: 'Ana',
  persona_apellido: 'Pérez',
} as unknown as UsuarioConRoles

function conPermisoDeActualizar() {
  const permisos = [
    {
      id: 'p1',
      codigo: 'workflows.actualizar',
      modulo: 'Workflows',
      accion: 'actualizar',
      tipo_informacion: null,
    },
  ]
  useAuthStore.setState({
    usuario: {
      id: 'u1',
      email: 'admin@esseri.edu.ar',
      auth_provider: 'local',
      estado: 'activo',
      nombre_google: null,
      avatar_url: null,
      persona_nombre: null,
      persona_apellido: null,
      roles: ['admin'],
      permisos,
      perfiles: [{ id: 'admin', codigo: 'admin', nombre: 'admin', descripcion: null, permisos }],
      rol_activo: 'admin',
    },
    status: 'authenticated',
    rolActivo: 'admin',
  })
}

function renderCampos(props: Partial<Parameters<typeof DestinatariosCampos>[0]> = {}) {
  return render(
    <DestinatariosCampos
      seleccion={{ rolIds: [], usuarioIds: [] }}
      guardados={{ roles: [], usuarios: [] }}
      disponibles={{
        roles: [rol],
        usuarios: [admin, secretaria],
        cargando: false,
        noDisponible: false,
      }}
      deshabilitado={false}
      onCambiar={vi.fn()}
      {...props}
    />,
  )
}

beforeAll(() => {
  // jsdom no implementa estas APIs, que usan el popover y el buscador.
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

beforeEach(() => {
  conPermisoDeActualizar()
})

describe('DestinatariosCampos', () => {
  it('rotula el selector como "Destinatarios de la regla" salvo que se indique otra cosa', () => {
    renderCampos()
    expect(screen.getByText('Destinatarios de la regla')).toBeInTheDocument()
  })

  it('usa la etiqueta que recibe, p. ej. "Asignar a" para las acciones que asignan tareas', () => {
    renderCampos({ etiqueta: 'Asignar a' })
    expect(screen.getByText('Asignar a')).toBeInTheDocument()
    expect(screen.queryByText('Destinatarios de la regla')).not.toBeInTheDocument()
  })

  it('el buscador encuentra a un usuario por su email, no solo por el nombre que se muestra', async () => {
    renderCampos()
    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.type(screen.getByPlaceholderText('Buscar'), 'tareas.admin@esseri')

    expect(await screen.findByText('Admin, Tareas')).toBeInTheDocument()
    expect(screen.queryByText('Pérez, Ana')).not.toBeInTheDocument()
  })

  it('el buscador sigue encontrando por el nombre', async () => {
    renderCampos()
    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.type(screen.getByPlaceholderText('Buscar'), 'Pérez')

    expect(await screen.findByText('Pérez, Ana')).toBeInTheDocument()
    expect(screen.queryByText('Admin, Tareas')).not.toBeInTheDocument()
  })

  it('al elegir un usuario avisa con su id', async () => {
    const onCambiar = vi.fn()
    renderCampos({ onCambiar })
    await userEvent.click(screen.getByRole('combobox'))

    await userEvent.click(await screen.findByText('Admin, Tareas'))

    expect(onCambiar).toHaveBeenCalledWith({ rolIds: [], usuarioIds: ['u-1'] })
  })
})
