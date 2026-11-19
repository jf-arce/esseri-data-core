import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PortalLayout } from '@/layout/portal-layout'
import { listarNotificaciones } from '@/modules/notificaciones/services/listar-notificaciones'
import { obtenerResumenNotificaciones } from '@/modules/notificaciones/services/obtener-resumen-notificaciones'
import type { UsuarioActual } from '@/modules/auth/types'
import { useAuthStore } from '@/store/auth-store'

vi.mock('@/modules/notificaciones/services/listar-notificaciones')
vi.mock('@/modules/notificaciones/services/obtener-resumen-notificaciones')
vi.mock('@/modules/notificaciones/services/marcar-notificacion-leida')
vi.mock('@/modules/notificaciones/services/marcar-todas-notificaciones-leidas')

const mockedResumen = vi.mocked(obtenerResumenNotificaciones)
const mockedListar = vi.mocked(listarNotificaciones)

function crearUsuario(id = 'usuario-1', rol = 'familia'): UsuarioActual {
  return {
    id,
    email: `${id}@esseri.test`,
    auth_provider: 'local',
    estado: 'activo',
    nombre_google: null,
    avatar_url: null,
    persona_nombre: 'Laura',
    persona_apellido: 'García',
    roles: [rol],
    permisos: [],
    perfiles: [{ id: `perfil-${rol}`, codigo: rol, nombre: rol, descripcion: null, permisos: [] }],
    rol_activo: rol,
  }
}

function renderPortal() {
  return render(
    <MemoryRouter initialEntries={['/familia']}>
      <Routes>
        <Route element={<PortalLayout />}>
          <Route path="/familia" element={<div>Inicio del portal</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedResumen.mockResolvedValue({ total_no_leidas: 3 })
  mockedListar.mockResolvedValue({
    items: [
      {
        id: 'notificacion-1',
        tipo: 'academico.inasistencia_registrada',
        titulo: 'Inasistencia registrada',
        mensaje: 'Se registró una ausencia de Juan el 17/11.',
        created_at: '2026-11-17T12:00:00Z',
        leida_at: null,
        destino: { tipo: 'asistencia', id: 'asistencia-1', alumno_id: 'alumno-1' },
      },
    ],
    siguiente_cursor: null,
    total_no_leidas: 3,
  })
  useAuthStore.setState({
    usuario: crearUsuario(),
    status: 'authenticated',
    rolActivo: 'familia',
  })
})

afterEach(() => {
  useAuthStore.setState({ usuario: null, status: 'idle', rolActivo: null })
})

describe('PortalLayout con notificaciones internas', () => {
  it('conecta la campanita solo en el Portal Familia', async () => {
    renderPortal()

    const boton = await screen.findByRole('button', { name: /3 sin leer/ })
    fireEvent.click(boton)

    const panel = await screen.findByRole('dialog')
    expect(within(panel).getByRole('heading', { name: 'Notificaciones' })).toBeInTheDocument()
    expect(within(panel).getByText('Inasistencia registrada')).toBeInTheDocument()
  })

  it('mantiene la campanita deshabilitada fuera de Familia', async () => {
    useAuthStore.setState({
      usuario: crearUsuario('usuario-admin', 'administracion'),
      status: 'authenticated',
      rolActivo: 'administracion',
    })

    renderPortal()

    expect(
      await screen.findByRole('button', { name: 'No hay notificaciones nuevas' }),
    ).toBeDisabled()
    expect(mockedResumen).not.toHaveBeenCalled()
  })

  it('reinicia el panel y el contador cuando cambia la cuenta', async () => {
    let totalNoLeidas = 3
    mockedResumen.mockImplementation(() => Promise.resolve({ total_no_leidas: totalNoLeidas }))

    renderPortal()
    const boton = await screen.findByRole('button', { name: /3 sin leer/ })
    fireEvent.click(boton)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    totalNoLeidas = 1
    act(() => {
      useAuthStore.setState({
        usuario: crearUsuario('usuario-2'),
        status: 'authenticated',
        rolActivo: 'familia',
      })
    })

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByRole('button', { name: /1 sin leer/ })).toBeInTheDocument()
  })
})
