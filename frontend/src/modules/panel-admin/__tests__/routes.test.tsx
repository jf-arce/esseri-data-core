import { render, screen } from '@testing-library/react'
import { MemoryRouter, useRoutes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { panelAdminRoutes } from '@/modules/panel-admin/routes'
import { useAuthStore } from '@/store/auth-store'

vi.mock('@/modules/panel-admin/hooks/use-indicadores-direccion', () => ({
  useIndicadoresDireccion: () => ({
    datos: {
      alumnos_activos: 1,
      deuda_pendiente_total: '100.00',
      inasistencias_hoy: 0,
      solicitudes_compra_pendientes: 0,
    },
    cargando: false,
    error: null,
  }),
}))

function RutasPaneles() {
  return useRoutes([...panelAdminRoutes, { path: '/', element: <p>Inicio</p> }])
}

function renderConUsuario(ruta: string, roles: string[], permisos: string[]) {
  const permisosDelRol = permisos.map((codigo, indice) => ({
    id: `p${indice}`,
    codigo,
    modulo: 'Panel Administrativo',
    accion: 'leer',
    tipo_informacion: null,
  }))

  useAuthStore.setState({
    usuario: {
      id: 'u1',
      email: 'usuario@esseri.edu.ar',
      auth_provider: 'local',
      estado: 'activo',
      roles,
      permisos: permisosDelRol,
      perfiles: roles.map((codigo) => ({
        id: codigo,
        codigo,
        nombre: codigo,
        descripcion: null,
        permisos: permisosDelRol,
      })),
      rol_activo: roles[0] ?? null,
    },
    status: 'authenticated',
    // El rol activo (elegido en "¿Cómo querés entrar?"/"Cambiar vista") es lo que filtran
    // RoleRoute y PermisoRoute — un solo rol en el test, así que es directamente ese.
    rolActivo: roles[0] ?? null,
  })

  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <RutasPaneles />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useAuthStore.setState({ usuario: null, status: 'idle', rolActivo: null })
})

describe('rutas del panel administrativo', () => {
  it('muestra el panel de Dirección al rol y permiso correspondientes', () => {
    renderConUsuario('/panel', ['direccion'], ['panel_administrativo.leer'])

    expect(screen.getByRole('heading', { name: 'Panel de Dirección' })).toBeInTheDocument()
  })

  it('redirige a inicio si Administración intenta entrar al panel de Dirección', () => {
    renderConUsuario('/panel', ['administracion'], ['panel_administrativo.leer'])

    expect(screen.getByText('Inicio')).toBeInTheDocument()
  })

  it('mantiene el mensaje de permiso cuando Dirección no tiene acceso al módulo', () => {
    renderConUsuario('/panel', ['direccion'], [])

    expect(screen.getByText('No tenés acceso a esta sección')).toBeInTheDocument()
  })

  it('muestra los accesos operativos al rol Administración', () => {
    renderConUsuario(
      '/admin',
      ['administracion'],
      ['panel_administrativo.leer', 'proveedores_compras.leer'],
    )

    expect(screen.getByRole('heading', { name: 'Panel Administrativo' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /abrir compras/i })).toBeInTheDocument()
  })

  it('oculta los accesos a módulos sin permiso de lectura', () => {
    renderConUsuario('/admin', ['administracion'], ['panel_administrativo.leer'])

    expect(screen.queryByRole('link', { name: /abrir compras/i })).not.toBeInTheDocument()
  })

  it('administrador del sistema también puede entrar a /admin (= todo en grupo-b.yaml)', () => {
    renderConUsuario('/admin', ['administrador_del_sistema'], ['panel_administrativo.leer'])

    expect(screen.getByRole('heading', { name: 'Panel Administrativo' })).toBeInTheDocument()
  })

  it('administrador del sistema también puede entrar a /panel', () => {
    renderConUsuario('/panel', ['administrador_del_sistema'], ['panel_administrativo.leer'])

    expect(screen.getByRole('heading', { name: 'Panel de Dirección' })).toBeInTheDocument()
  })
})
