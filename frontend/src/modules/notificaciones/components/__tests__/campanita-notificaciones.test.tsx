import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CampanitaNotificaciones } from '@/modules/notificaciones/components/campanita-notificaciones'
import { listarNotificaciones } from '@/modules/notificaciones/services/listar-notificaciones'
import { marcarNotificacionLeida } from '@/modules/notificaciones/services/marcar-notificacion-leida'
import { marcarTodasNotificacionesLeidas } from '@/modules/notificaciones/services/marcar-todas-notificaciones-leidas'
import { obtenerResumenNotificaciones } from '@/modules/notificaciones/services/obtener-resumen-notificaciones'
import type { ListadoNotificaciones, NotificacionInterna } from '@/modules/notificaciones/types'

vi.mock('@/modules/notificaciones/services/listar-notificaciones')
vi.mock('@/modules/notificaciones/services/obtener-resumen-notificaciones')
vi.mock('@/modules/notificaciones/services/marcar-notificacion-leida')
vi.mock('@/modules/notificaciones/services/marcar-todas-notificaciones-leidas')

const mockedListar = vi.mocked(listarNotificaciones)
const mockedResumen = vi.mocked(obtenerResumenNotificaciones)
const mockedMarcarLeida = vi.mocked(marcarNotificacionLeida)
const mockedMarcarTodas = vi.mocked(marcarTodasNotificacionesLeidas)

function crearNotificacion(overrides: Partial<NotificacionInterna> = {}): NotificacionInterna {
  return {
    id: 'notificacion-1',
    tipo: 'academico.inasistencia_registrada',
    titulo: 'Inasistencia registrada',
    mensaje: 'Se registró una ausencia de Juan el 17/11.',
    created_at: '2026-11-17T12:00:00Z',
    leida_at: null,
    destino: { tipo: 'asistencia', id: 'asistencia-1', alumno_id: 'alumno-1' },
    ...overrides,
  }
}

function crearListado(overrides: Partial<ListadoNotificaciones> = {}): ListadoNotificaciones {
  return {
    items: [],
    siguiente_cursor: null,
    total_no_leidas: 0,
    ...overrides,
  }
}

function DestinoAsistencias() {
  const ubicacion = useLocation()
  return <div data-testid="destino-asistencias">{`${ubicacion.pathname}${ubicacion.search}`}</div>
}

function renderCampanita() {
  return render(
    <MemoryRouter initialEntries={['/familia']}>
      <Routes>
        <Route
          path="/familia"
          element={<CampanitaNotificaciones usuarioId="usuario-1" rolActivo="familia" />}
        />
        <Route path="/familia/asistencias" element={<DestinoAsistencias />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function abrirPanel() {
  const boton = await screen.findByRole('button', { name: /sin leer|No hay notificaciones/ })
  fireEvent.click(boton)
  return screen.findByRole('dialog')
}

function renderCampanitaPersistente() {
  return render(
    <MemoryRouter initialEntries={['/familia']}>
      <CampanitaNotificaciones usuarioId="usuario-1" rolActivo="familia" />
      <Routes>
        <Route path="/familia" element={<div>Inicio</div>} />
        <Route path="/familia/asistencias" element={<DestinoAsistencias />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedResumen.mockResolvedValue({ total_no_leidas: 3 })
  mockedListar.mockResolvedValue(crearListado({ items: [crearNotificacion()], total_no_leidas: 3 }))
  mockedMarcarLeida.mockResolvedValue({
    id: 'notificacion-1',
    leida_at: '2026-11-17T12:01:00Z',
  })
  mockedMarcarTodas.mockResolvedValue({ marcadas: 3 })
})

describe('CampanitaNotificaciones', () => {
  it('muestra el contador numérico accesible y abre el panel sin marcar todo como leído', async () => {
    renderCampanita()

    const boton = await screen.findByRole('button', { name: /3 sin leer/ })
    expect(boton).not.toBeDisabled()

    fireEvent.click(boton)
    const panel = await screen.findByRole('dialog')

    expect(within(panel).getByRole('heading', { name: 'Notificaciones' })).toBeInTheDocument()
    expect(within(panel).getByText('3 nuevas')).toBeInTheDocument()
    expect(within(panel).getByText('Inasistencia registrada')).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'No leídas' })).toBeInTheDocument()
    expect(mockedMarcarTodas).not.toHaveBeenCalled()
    expect(mockedMarcarLeida).not.toHaveBeenCalled()
  })

  it('no muestra un cero ni un texto de no-novedades cuando falla el contador', async () => {
    mockedResumen.mockRejectedValue(new Error('network'))
    renderCampanita()

    await waitFor(() => expect(mockedResumen).toHaveBeenCalled())
    expect(
      await screen.findByRole('button', { name: /No se pudo actualizar el contador/ }),
    ).toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('No hay notificaciones nuevas')).not.toBeInTheDocument()
  })

  it('filtra entre todas y no leídas contra el servicio', async () => {
    const leida = crearNotificacion({
      id: 'notificacion-leida',
      tipo: 'academico.justificacion_aprobada',
      titulo: 'Justificación aprobada',
      leida_at: '2026-11-17T10:00:00Z',
    })
    const noLeida = crearNotificacion({ id: 'notificacion-no-leida' })
    mockedListar.mockImplementation(({ noLeidas }) =>
      Promise.resolve(
        crearListado({
          items: noLeidas ? [noLeida] : [leida, noLeida],
          total_no_leidas: 1,
        }),
      ),
    )

    renderCampanita()
    const panel = await abrirPanel()
    expect(await within(panel).findByText('Justificación aprobada')).toBeInTheDocument()

    fireEvent.click(within(panel).getByRole('button', { name: 'No leídas' }))

    await waitFor(() =>
      expect(mockedListar).toHaveBeenLastCalledWith(expect.objectContaining({ noLeidas: true })),
    )
    await waitFor(() =>
      expect(within(panel).queryByText('Justificación aprobada')).not.toBeInTheDocument(),
    )
    expect(within(panel).getByRole('button', { name: 'No leídas' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('quita del filtro de no leídas la leída y vacía la lista al marcar todas', async () => {
    const n1 = crearNotificacion({ id: 'n-1', titulo: 'Aviso n-1' })
    const n2 = crearNotificacion({ id: 'n-2', titulo: 'Aviso n-2' })
    mockedListar.mockImplementation(({ noLeidas }) =>
      Promise.resolve(
        crearListado({
          items: noLeidas ? [n1, n2] : [n1, n2],
          total_no_leidas: 2,
        }),
      ),
    )

    renderCampanita()
    const panel = await abrirPanel()

    fireEvent.click(within(panel).getByRole('button', { name: 'No leídas' }))
    await waitFor(() =>
      expect(mockedListar).toHaveBeenLastCalledWith(expect.objectContaining({ noLeidas: true })),
    )
    expect(await within(panel).findByText('Aviso n-1')).toBeInTheDocument()
    expect(within(panel).getByText('Aviso n-2')).toBeInTheDocument()

    fireEvent.click(within(panel).getByRole('button', { name: 'Marcar como leída: Aviso n-1' }))
    await waitFor(() => expect(mockedMarcarLeida).toHaveBeenCalledWith('n-1'))
    await waitFor(() => expect(within(panel).queryByText('Aviso n-1')).not.toBeInTheDocument())
    expect(within(panel).getByText('Aviso n-2')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /1 sin leer/ })).toBeInTheDocument()

    fireEvent.click(within(panel).getByRole('button', { name: 'Marcar todas como leídas' }))
    await waitFor(() => expect(mockedMarcarTodas).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(within(panel).queryByText('Aviso n-2')).not.toBeInTheDocument())
    expect(within(panel).getByText('No hay notificaciones sin leer')).toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: /No hay notificaciones sin leer/ }),
    ).toBeInTheDocument()
  })

  it('pide la página siguiente con el cursor y agrega sus elementos', async () => {
    mockedListar
      .mockResolvedValueOnce(
        crearListado({
          items: [crearNotificacion({ id: 'n-1', titulo: 'Primera notificación' })],
          siguiente_cursor: 'cursor-1',
          total_no_leidas: 2,
        }),
      )
      .mockResolvedValueOnce(
        crearListado({
          items: [crearNotificacion({ id: 'n-2', titulo: 'Segunda notificación' })],
          siguiente_cursor: null,
          total_no_leidas: 2,
        }),
      )

    renderCampanita()
    const panel = await abrirPanel()
    expect(await within(panel).findByText('Primera notificación')).toBeInTheDocument()

    fireEvent.click(within(panel).getByRole('button', { name: 'Cargar más' }))

    expect(await within(panel).findByText('Segunda notificación')).toBeInTheDocument()
    expect(mockedListar).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'cursor-1', noLeidas: false }),
    )
    expect(within(panel).queryByRole('button', { name: 'Cargar más' })).not.toBeInTheDocument()
  })

  it('marca todas como leídas solo con la acción explícita', async () => {
    renderCampanita()
    const panel = await abrirPanel()

    fireEvent.click(within(panel).getByRole('button', { name: 'Marcar todas como leídas' }))

    await waitFor(() => expect(mockedMarcarTodas).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(within(panel).queryByText('3 nuevas')).not.toBeInTheDocument())
    expect(
      within(panel).queryByRole('button', { name: /Marcar como leída:/ }),
    ).not.toBeInTheDocument()
    expect(
      within(panel).queryByRole('button', { name: 'Marcar todas como leídas' }),
    ).not.toBeInTheDocument()
  })

  it('mantiene la notificación sin leer y avisa si falla la lectura individual', async () => {
    mockedMarcarLeida.mockRejectedValue(new Error('network'))
    renderCampanita()
    const panel = await abrirPanel()

    fireEvent.click(
      within(panel).getByRole('button', { name: 'Marcar como leída: Inasistencia registrada' }),
    )

    const alerta = await within(panel).findByRole('alert')
    expect(alerta).toHaveTextContent('No se pudo marcar la notificación como leída.')
    expect(
      within(panel).getByRole('button', { name: 'Marcar como leída: Inasistencia registrada' }),
    ).toBeInTheDocument()
  })

  it('navega al registro exacto aunque falle la marcación de lectura', async () => {
    mockedMarcarLeida.mockRejectedValue(new Error('network'))
    renderCampanita()
    const panel = await abrirPanel()

    fireEvent.click(within(panel).getByRole('link', { name: /Inasistencia registrada/ }))

    expect(await screen.findByTestId('destino-asistencias')).toHaveTextContent(
      '/familia/asistencias?alumno=alumno-1&seccion=historial&recurso=asistencia&recurso_id=asistencia-1',
    )
    await waitFor(() => expect(mockedMarcarLeida).toHaveBeenCalledWith('notificacion-1'))
  })

  it('cierra el panel al navegar desde una notificación', async () => {
    renderCampanitaPersistente()
    const panel = await abrirPanel()

    fireEvent.click(within(panel).getByRole('link', { name: /Inasistencia registrada/ }))

    expect(await screen.findByTestId('destino-asistencias')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('no arma una URL arbitraria con un destino desconocido', async () => {
    mockedListar.mockResolvedValue(
      crearListado({
        items: [
          crearNotificacion({
            titulo: 'Aviso sin destino',
            destino: {
              tipo: 'facturacion.factura' as never,
              id: 'factura-1',
              alumno_id: 'alumno-1',
            },
          }),
        ],
        total_no_leidas: 1,
      }),
    )

    renderCampanita()
    const panel = await abrirPanel()

    expect(await within(panel).findByText('Aviso sin destino')).toBeInTheDocument()
    expect(within(panel).queryByRole('link', { name: /Aviso sin destino/ })).not.toBeInTheDocument()
    expect(panel.innerHTML).not.toContain('/familia/asistencias?')
  })

  it('muestra esqueletos con la forma del listado mientras carga', async () => {
    let resolver!: (listado: ListadoNotificaciones) => void
    mockedListar.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolver = resolve
        }),
    )

    renderCampanita()
    const boton = await screen.findByRole('button', { name: /3 sin leer/ })
    fireEvent.click(boton)
    const panel = await screen.findByRole('dialog')

    expect(within(panel).getByLabelText('Cargando notificaciones')).toBeInTheDocument()

    await act(async () => {
      resolver(crearListado({ items: [crearNotificacion()], total_no_leidas: 3 }))
    })
    expect(await within(panel).findByText('Inasistencia registrada')).toBeInTheDocument()
  })

  it('muestra estados vacíos distintos para todas y para no leídas', async () => {
    mockedListar.mockResolvedValue(crearListado())
    renderCampanita()
    const panel = await abrirPanel()

    expect(await within(panel).findByText('No hay notificaciones')).toBeInTheDocument()

    fireEvent.click(within(panel).getByRole('button', { name: 'No leídas' }))

    expect(await within(panel).findByText('No hay notificaciones sin leer')).toBeInTheDocument()
  })

  it('muestra el error de carga y permite reintentar', async () => {
    mockedListar.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(crearListado())

    renderCampanita()
    const panel = await abrirPanel()

    expect(
      await within(panel).findByText('No pudimos cargar las notificaciones'),
    ).toBeInTheDocument()

    fireEvent.click(within(panel).getByRole('button', { name: 'Reintentar' }))

    expect(await within(panel).findByText('No hay notificaciones')).toBeInTheDocument()
  })

  it('devuelve el foco a la campanita al cerrar con Escape', async () => {
    const usuario = userEvent.setup()
    renderCampanita()

    const boton = await screen.findByRole('button', { name: /3 sin leer/ })
    fireEvent.click(boton)
    await screen.findByRole('dialog')

    await usuario.keyboard('{Escape}')

    await waitFor(() => expect(boton).toHaveFocus())
  })
})
