import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GlobalSearchDialog } from '@/layout/global-search-dialog'
import { listarFacturas } from '@/modules/facturacion/services/listar-facturas'
import { listarInscripciones } from '@/modules/inscripciones/services/listar-inscripciones'
import { listarSolicitudesAdmision } from '@/modules/inscripciones/services/solicitudes-admision'
import { getUsuarios } from '@/modules/auth/services/get-usuarios'
import { useAuthStore } from '@/store/auth-store'

const PLACEHOLDER = 'Buscar alumno, aspirante, legajo, DNI, factura o usuario…'

// El buscador filtra "Ir a"/"Acciones" por el permiso `.leer`/`.crear` del rol activo — un rol
// con acceso a todo lo que este archivo prueba (mismo criterio que "administrador del sistema").
const PERMISOS_DE_PRUEBA = [
  'familias_alumnos.leer',
  'inscripciones.leer',
  'inscripciones.crear',
  'facturacion.leer',
  'facturacion.crear',
  'autenticacion.leer',
  'autenticacion.crear',
  'autenticacion.actualizar',
].map((codigo, indice) => ({
  id: `p${indice}`,
  codigo,
  modulo: codigo,
  accion: codigo.split('.')[1],
  tipo_informacion: null,
}))

vi.mock('@/modules/facturacion/services/listar-facturas')
vi.mock('@/modules/inscripciones/services/listar-inscripciones')
vi.mock('@/modules/inscripciones/services/solicitudes-admision')
vi.mock('@/modules/auth/services/get-usuarios')

const mockedListarFacturas = vi.mocked(listarFacturas)
const mockedListarInscripciones = vi.mocked(listarInscripciones)
const mockedListarSolicitudesAdmision = vi.mocked(listarSolicitudesAdmision)
const mockedGetUsuarios = vi.mocked(getUsuarios)

function renderDialogo() {
  return render(
    <MemoryRouter>
      <GlobalSearchDialog open onOpenChange={() => {}} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({
    usuario: {
      id: 'u1',
      email: 'a@esseri.edu.ar',
      auth_provider: 'local',
      estado: 'activo',
      roles: ['administrador del sistema'],
      permisos: PERMISOS_DE_PRUEBA,
      perfiles: [
        {
          id: 'administrador_del_sistema',
          codigo: 'administrador_del_sistema',
          nombre: 'administrador del sistema',
          descripcion: null,
          permisos: PERMISOS_DE_PRUEBA,
        },
      ],
      rol_activo: 'administrador_del_sistema',
    },
    status: 'authenticated',
    rolActivo: 'administrador_del_sistema',
  })
  mockedListarInscripciones.mockResolvedValue({
    items: [
      {
        id: 'inscripcion-1',
        alumno_nombre: 'Sofía',
        alumno_apellido: 'Demo',
        numero_legajo: 'DEMO-001',
        division_nombre: '1° A',
      },
    ],
  } as never)
  mockedListarSolicitudesAdmision.mockResolvedValue({
    items: [
      {
        id: 'solicitud-1',
        aspirante_nombre: 'Martina',
        aspirante_apellido: 'Ibáñez',
        etapa: 'entrevista',
        ciclo_lectivo: '2027',
      },
    ],
  } as never)
  mockedListarFacturas.mockResolvedValue({
    items: [
      {
        id: 'abc12345-0000-0000-0000-000000000000',
        estado: 'pendiente',
        monto_total: '20000.00',
      },
    ],
  } as never)
  mockedGetUsuarios.mockResolvedValue([
    {
      id: 'usuario-1',
      email: 'sofia.demo@esseri.edu.ar',
      estado: 'activo',
      auth_provider: 'local',
      ultimo_acceso: null,
      roles: [],
      persona_id: 'persona-1',
      persona_nombre: 'Sofía',
      persona_apellido: 'Demo',
    },
  ])
})

describe('GlobalSearchDialog', () => {
  it('ofrece accesos a los submódulos clave', () => {
    renderDialogo()

    expect(screen.getByText('Nueva inscripción')).toBeInTheDocument()
    expect(screen.getByText('Admisiones')).toBeInTheDocument()
    expect(screen.getByText('Reglas de facturación')).toBeInTheDocument()
  })

  it('desglosa "Usuarios y roles" en sus 4 destinos, no uno solo', () => {
    renderDialogo()

    expect(screen.getByText('Usuarios')).toBeInTheDocument()
    expect(screen.getByText('Roles')).toBeInTheDocument()
    expect(screen.getByText('Permisos')).toBeInTheDocument()
    expect(screen.getByText('Matriz de permisos')).toBeInTheDocument()
    expect(screen.queryByText('Usuarios y roles')).not.toBeInTheDocument()
  })

  it('ofrece las acciones de alta de usuarios, roles y permisos', () => {
    renderDialogo()

    expect(screen.getByText('Nuevo usuario')).toBeInTheDocument()
    expect(screen.getByText('Nuevo rol')).toBeInTheDocument()
    expect(screen.getByText('Nuevo permiso')).toBeInTheDocument()
  })

  it('oculta "Nuevo rol"/"Nuevo permiso" sin el permiso de crear autenticación', () => {
    const sinCrear = PERMISOS_DE_PRUEBA.filter((p) => p.codigo !== 'autenticacion.crear')
    useAuthStore.setState({
      usuario: {
        id: 'u1',
        email: 'a@esseri.edu.ar',
        auth_provider: 'local',
        estado: 'activo',
        roles: ['secretaría'],
        permisos: sinCrear,
        perfiles: [
          { id: 'secretaria', codigo: 'secretaria', nombre: 'secretaría', descripcion: null, permisos: sinCrear },
        ],
        rol_activo: 'secretaria',
      },
      status: 'authenticated',
      rolActivo: 'secretaria',
    })
    renderDialogo()

    expect(screen.queryByText('Nuevo rol')).not.toBeInTheDocument()
    expect(screen.queryByText('Nuevo permiso')).not.toBeInTheDocument()
  })

  it('busca inscripciones, admisiones y facturas desde la misma paleta', async () => {
    const user = userEvent.setup()
    renderDialogo()

    await user.type(screen.getByPlaceholderText(PLACEHOLDER), 'Sofía')

    await waitFor(() => expect(screen.getAllByText('Demo, Sofía').length).toBeGreaterThan(0))
    expect(mockedListarSolicitudesAdmision).toHaveBeenCalled()
    expect(mockedListarFacturas).toHaveBeenCalled()
  })

  it('busca usuarios por nombre y muestra el email como detalle', async () => {
    const user = userEvent.setup()
    renderDialogo()

    await user.type(screen.getByPlaceholderText(PLACEHOLDER), 'Sofía')

    await waitFor(() => expect(mockedGetUsuarios).toHaveBeenCalled())
    expect(await screen.findByText('sofia.demo@esseri.edu.ar')).toBeInTheDocument()
  })

  it('busca usuarios por email', async () => {
    const user = userEvent.setup()
    renderDialogo()

    await user.type(screen.getByPlaceholderText(PLACEHOLDER), 'sofia.demo@')

    expect(await screen.findByText('sofia.demo@esseri.edu.ar')).toBeInTheDocument()
  })

  it('no vuelve a pedir la lista de usuarios en cada tecla (se cachea por apertura)', async () => {
    const user = userEvent.setup()
    renderDialogo()

    await user.type(screen.getByPlaceholderText(PLACEHOLDER), 'Sofía')
    await waitFor(() => expect(mockedGetUsuarios).toHaveBeenCalledTimes(1))

    await user.type(screen.getByPlaceholderText(PLACEHOLDER), 'a')
    await waitFor(() => expect(mockedListarFacturas).toHaveBeenCalledTimes(2))
    expect(mockedGetUsuarios).toHaveBeenCalledTimes(1)
  })

  it('conserva los resultados autorizados si un módulo no puede consultarse', async () => {
    const user = userEvent.setup()
    mockedListarFacturas.mockRejectedValue(new Error('Sin permiso'))
    renderDialogo()

    await user.type(screen.getByPlaceholderText(PLACEHOLDER), 'Sofía')

    await waitFor(() => expect(screen.getAllByText('Demo, Sofía').length).toBeGreaterThan(0))
  })

  it('no busca en un módulo si el rol activo no tiene su permiso .leer', async () => {
    const user = userEvent.setup()
    const permisosSinFacturacion = PERMISOS_DE_PRUEBA.filter(
      (permiso) => permiso.codigo !== 'facturacion.leer',
    )
    useAuthStore.setState({
      usuario: {
        id: 'u1',
        email: 'a@esseri.edu.ar',
        auth_provider: 'local',
        estado: 'activo',
        roles: ['secretaría'],
        permisos: permisosSinFacturacion,
        perfiles: [
          {
            id: 'secretaria',
            codigo: 'secretaria',
            nombre: 'secretaría',
            descripcion: null,
            permisos: permisosSinFacturacion,
          },
        ],
        rol_activo: 'secretaria',
      },
      status: 'authenticated',
      rolActivo: 'secretaria',
    })
    renderDialogo()

    await user.type(screen.getByPlaceholderText(PLACEHOLDER), 'Sofía')

    await waitFor(() => expect(screen.getAllByText('Demo, Sofía').length).toBeGreaterThan(0))
    expect(mockedListarFacturas).not.toHaveBeenCalled()
  })

  it('no busca usuarios si el rol activo no tiene el permiso .leer de autenticación', async () => {
    const user = userEvent.setup()
    const sinAutenticacion = PERMISOS_DE_PRUEBA.filter(
      (permiso) => !permiso.codigo.startsWith('autenticacion.'),
    )
    useAuthStore.setState({
      usuario: {
        id: 'u1',
        email: 'a@esseri.edu.ar',
        auth_provider: 'local',
        estado: 'activo',
        roles: ['secretaría'],
        permisos: sinAutenticacion,
        perfiles: [
          {
            id: 'secretaria',
            codigo: 'secretaria',
            nombre: 'secretaría',
            descripcion: null,
            permisos: sinAutenticacion,
          },
        ],
        rol_activo: 'secretaria',
      },
      status: 'authenticated',
      rolActivo: 'secretaria',
    })
    renderDialogo()

    await user.type(screen.getByPlaceholderText(PLACEHOLDER), 'Sofía')

    await waitFor(() => expect(screen.getAllByText('Demo, Sofía').length).toBeGreaterThan(0))
    expect(mockedGetUsuarios).not.toHaveBeenCalled()
  })
})
