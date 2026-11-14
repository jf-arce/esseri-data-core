import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PortalLayout } from '@/layout/portal-layout'
import { PortalFamiliaPage } from '@/pages/portal-familia-page'
import type { AsistenciaFamilia } from '@/modules/academico/types'
import { listarAsistenciasFamilia } from '@/modules/academico/services/listar-asistencias-familia'
import type { UsuarioActual } from '@/modules/auth/types'
import type { Listado } from '@/modules/comunicaciones/types'
import { listarComunicaciones } from '@/modules/comunicaciones/services/listar-comunicaciones'
import { useMisAlumnos } from '@/modules/familias-alumnos/hooks/use-mis-alumnos'
import type { FacturaFamilia, FacturacionFamilia } from '@/modules/facturacion/types'
import { listarFacturacionFamilia } from '@/modules/facturacion/services/listar-facturacion-familia'
import { formatearMoneda } from '@/modules/facturacion/utils'
import { useAuthStore } from '@/store/auth-store'

vi.mock('@/modules/familias-alumnos/hooks/use-mis-alumnos')
vi.mock('@/modules/comunicaciones/services/listar-comunicaciones')
vi.mock('@/modules/academico/services/listar-asistencias-familia')
vi.mock('@/modules/facturacion/services/listar-facturacion-familia')

const mockedUseMisAlumnos = vi.mocked(useMisAlumnos)
const mockedListarComunicaciones = vi.mocked(listarComunicaciones)
const mockedListarAsistencias = vi.mocked(listarAsistenciasFamilia)
const mockedListarFacturacion = vi.mocked(listarFacturacionFamilia)

const ALUMNOS = [
  {
    alumno_id: 'alumno-1',
    nombre: 'Juan',
    apellido: 'Gómez',
    division_etiqueta: '4°B · Primario',
  },
  {
    alumno_id: 'alumno-2',
    nombre: 'Ana',
    apellido: 'Gómez',
    division_etiqueta: null,
  },
]

function crearUsuario(): UsuarioActual {
  return {
    id: 'usuario-1',
    email: 'laura@esseri.test',
    auth_provider: 'local',
    estado: 'activo',
    nombre_google: null,
    avatar_url: null,
    persona_nombre: 'Laura García',
    persona_apellido: 'García',
    roles: ['familia'],
    permisos: [],
    perfiles: [],
    rol_activo: 'familia',
  }
}

function crearAsistencia(overrides: Partial<AsistenciaFamilia>): AsistenciaFamilia {
  return {
    id: 'asistencia-1',
    fecha: '2027-03-15',
    tipo: 'presente',
    inscripcion_id: 'inscripcion-1',
    updated_at: '2027-03-15T08:00:00',
    justificacion_id: null,
    justificacion_estado: null,
    justificacion_motivo: null,
    justificacion_observacion: null,
    justificacion_archivo_nombre: null,
    ...overrides,
  }
}

function crearFactura(overrides: Partial<FacturaFamilia> = {}): FacturaFamilia {
  return {
    id: 'factura-1',
    alumno_id: 'alumno-1',
    fecha_emision: '2027-03-01',
    fecha_vencimiento: '2027-03-10',
    fecha_vencimiento_efectiva: '2027-03-10',
    monto_total: '15000',
    estado: 'vencida',
    alumno_nombre: 'Gómez, Juan',
    detalles: [],
    pagos: [],
    ...overrides,
  }
}

function crearFacturacion(overrides: Partial<FacturacionFamilia> = {}): FacturacionFamilia {
  return {
    total_debe: '0',
    total_haber: '0',
    saldo: '0',
    facturas: [],
    movimientos: [],
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <PortalFamiliaPage />
    </MemoryRouter>,
  )
}

/** Tarjeta que contiene el texto indicado, sin depender de data-testid. */
function tarjetaCon(texto: string) {
  const referencia = screen.getByText(texto)
  const tarjeta = referencia.closest('[data-slot="card"]')
  expect(tarjeta).not.toBeNull()
  return tarjeta as HTMLElement
}

describe('PortalFamiliaPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedUseMisAlumnos.mockReturnValue({ alumnos: ALUMNOS, cargando: false })
    mockedListarComunicaciones.mockResolvedValue({
      items: [],
      total: 2,
      pagina: 1,
      total_paginas: 1,
    } satisfies Listado)
    mockedListarAsistencias.mockImplementation((alumnoId) =>
      Promise.resolve(
        alumnoId === 'alumno-1'
          ? [crearAsistencia({ tipo: 'ausente_pendiente' })]
          : [crearAsistencia({ id: 'asistencia-2', tipo: 'presente' })],
      ),
    )
    mockedListarFacturacion.mockResolvedValue(crearFacturacion())
    useAuthStore.setState({
      usuario: crearUsuario(),
      status: 'authenticated',
      rolActivo: 'familia',
    })
  })

  afterEach(() => {
    useAuthStore.setState({ usuario: null, status: 'idle', rolActivo: null })
  })

  it('muestra el saludo y los tres indicadores del resumen', async () => {
    renderPage()

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Hola, Laura 👋' }),
    ).toBeInTheDocument()
    expect(
      await within(screen.getByRole('group', { name: 'Alumnos vinculados' })).findByText('2'),
    ).toBeInTheDocument()
    expect(
      await within(
        screen.getByRole('group', { name: 'Asistencias sin justificar' }),
      ).findByText('1'),
    ).toBeInTheDocument()
    expect(
      await within(screen.getByRole('group', { name: 'Mensajes sin leer' })).findByText('2'),
    ).toBeInTheDocument()
  })

  it('avisa las ausencias pendientes y ofrece justificarlas', async () => {
    renderPage()

    const cta = await screen.findByRole('link', { name: /Justificar ausencia/ })
    expect(cta).toHaveAttribute('href', '/familia/justificar-ausencia')
    expect(screen.getByText('Tenés una ausencia pendiente')).toBeInTheDocument()
  })

  it('no muestra el aviso cuando no hay ausencias pendientes', async () => {
    mockedListarAsistencias.mockResolvedValue([])
    renderPage()

    const indicador = screen.getByRole('group', { name: 'Asistencias sin justificar' })
    expect(await within(indicador).findByText('0')).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /Justificar ausencia/ }),
    ).not.toBeInTheDocument()
  })

  it('enlaza las gestiones de cada alumno con su identificador', async () => {
    renderPage()

    const tarjeta = tarjetaCon('Mis alumnos')
    const facturacion = await within(tarjeta).findAllByRole('link', { name: 'Facturación' })
    expect(facturacion.map((link) => link.getAttribute('href'))).toEqual([
      '/familia/facturacion?alumno=alumno-1',
      '/familia/facturacion?alumno=alumno-2',
    ])

    const asistencias = within(tarjeta).getAllByRole('link', { name: 'Asistencias' })
    expect(asistencias).toHaveLength(2)
    for (const link of asistencias) {
      expect(link).toHaveAttribute('href', '/familia/asistencias')
    }
  })

  it('muestra el saldo y el estado sin vencimientos de la cuenta familiar', async () => {
    renderPage()

    const tarjeta = tarjetaCon('Estado general de la cuenta familiar.')
    // Testing Library normaliza los espacios del DOM, así que el NBSP del formateador
    // también se normaliza antes de comparar.
    expect(
      await within(tarjeta).findByText(formatearMoneda(0).replace(/\s/g, ' ')),
    ).toBeInTheDocument()
    expect(within(tarjeta).getByText('Sin vencimientos')).toBeInTheDocument()
    expect(within(tarjeta).getByRole('link', { name: /Ver facturación/ })).toHaveAttribute(
      'href',
      '/familia/facturacion',
    )
  })

  it('muestra un saldo a favor en positivo cuando la cuenta tiene crédito', async () => {
    mockedListarFacturacion.mockResolvedValue(crearFacturacion({ saldo: '-1500' }))
    renderPage()

    const tarjeta = tarjetaCon('Estado general de la cuenta familiar.')
    expect(await within(tarjeta).findByText('Saldo a favor')).toBeInTheDocument()
    expect(
      within(tarjeta).getByText(formatearMoneda(1500).replace(/\s/g, ' ')),
    ).toBeInTheDocument()
    expect(
      within(tarjeta).queryByText(formatearMoneda(-1500).replace(/\s/g, ' ')),
    ).not.toBeInTheDocument()
  })

  it('indica la cantidad de facturas vencidas', async () => {
    mockedListarFacturacion.mockResolvedValue(
      crearFacturacion({
        saldo: '30000',
        facturas: [crearFactura(), crearFactura({ id: 'factura-2' })],
      }),
    )
    renderPage()

    const tarjeta = tarjetaCon('Estado general de la cuenta familiar.')
    expect(await within(tarjeta).findByText('2 vencidas')).toBeInTheDocument()
  })

  it('ofrece accesos rápidos solo a rutas existentes del portal', () => {
    renderPage()

    const tarjeta = tarjetaCon('Accesos rápidos')
    const accesos = within(tarjeta)
      .getAllByRole('link')
      .map((link) => ({
        nombre: link.textContent?.trim(),
        href: link.getAttribute('href'),
      }))

    expect(accesos).toEqual([
      { nombre: 'Calendario', href: '/familia/calendario' },
      { nombre: 'Mi cuenta', href: '/familia/facturacion' },
      { nombre: 'Asistencias', href: '/familia/asistencias' },
      { nombre: 'Informar ausencia', href: '/familia/informar-ausencia' },
    ])
  })

  it('sigue en pie si fallan las consultas del resumen', async () => {
    mockedListarComunicaciones.mockRejectedValue(new Error('network'))
    mockedListarAsistencias.mockRejectedValue(new Error('network'))
    mockedListarFacturacion.mockRejectedValue(new Error('network'))
    renderPage()

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Hola, Laura 👋' }),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(mockedListarComunicaciones).toHaveBeenCalled()
      expect(mockedListarFacturacion).toHaveBeenCalled()
    })
    expect(
      screen.queryByRole('link', { name: /Justificar ausencia/ }),
    ).not.toBeInTheDocument()
  })

  it('mantiene una sola cabecera del portal y marca Inicio como activo', async () => {
    render(
      <MemoryRouter initialEntries={['/familia']}>
        <Routes>
          <Route element={<PortalLayout />}>
            <Route path="/familia" element={<PortalFamiliaPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Hola, Laura 👋' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('banner')).toHaveLength(1)
    expect(screen.getAllByText('ESSERI')).toHaveLength(1)

    const fondo = document.querySelector('[data-slot="portal-familia-background"]')
    expect(fondo).toBeInTheDocument()
    expect(fondo?.getAttribute('style')).toContain('linear-gradient')

    const inicio = screen.getByRole('link', { name: 'Inicio' })
    expect(inicio).toHaveAttribute('aria-current', 'page')
    expect(inicio.className).toContain('bg-white/15')
  })
})
