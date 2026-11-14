import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PortalFamiliaTramitePage } from '@/pages/portal-familia-tramite-page'
import { listarAsistenciasFamilia } from '@/modules/academico/services/listar-asistencias-familia'
import {
  cancelarSolicitudAusencia,
  crearSolicitudAusenciaPeriodo,
  listarSolicitudesAusenciaFamilia,
  obtenerConfiguracionAusencias,
} from '@/modules/academico/services/solicitudes-ausencia-familia'
import { useMisAlumnos } from '@/modules/familias-alumnos/hooks/use-mis-alumnos'
import type { AsistenciaFamilia } from '@/modules/academico/types'
import { useCicloLectivoStore } from '@/store/ciclo-lectivo-store'

vi.mock('@/modules/academico/services/listar-asistencias-familia')
vi.mock('@/modules/academico/services/solicitudes-ausencia-familia')
vi.mock('@/modules/familias-alumnos/hooks/use-mis-alumnos')

const mockedListarAsistenciasFamilia = vi.mocked(listarAsistenciasFamilia)
const mockedListarSolicitudesFamilia = vi.mocked(listarSolicitudesAusenciaFamilia)
const mockedCancelarSolicitud = vi.mocked(cancelarSolicitudAusencia)
const mockedCrearSolicitud = vi.mocked(crearSolicitudAusenciaPeriodo)
const mockedObtenerConfiguracion = vi.mocked(obtenerConfiguracionAusencias)
const mockedUseMisAlumnos = vi.mocked(useMisAlumnos)

function crearAsistencia(overrides: Partial<AsistenciaFamilia>): AsistenciaFamilia {
  return {
    id: 'asistencia-generica',
    fecha: '2027-03-01',
    tipo: 'presente',
    inscripcion_id: 'inscripcion-1',
    updated_at: '2027-03-01T08:00:00',
    justificacion_id: null,
    justificacion_estado: null,
    justificacion_motivo: null,
    justificacion_observacion: null,
    justificacion_archivo_nombre: null,
    ...overrides,
  }
}

describe('PortalFamiliaTramitePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedListarSolicitudesFamilia.mockResolvedValue([])
    mockedCancelarSolicitud.mockResolvedValue({} as never)
    mockedObtenerConfiguracion.mockResolvedValue({ dias_limite_justificacion: 45 })
    mockedUseMisAlumnos.mockReturnValue({
      alumnos: [
        {
          alumno_id: 'alumno-1',
          nombre: 'Juan',
          apellido: 'Gómez',
          division_etiqueta: '4°B · Primario',
        },
      ],
      cargando: false,
    })
  })

  it('muestra una ausencia ya presentada como en revisión y no permite justificarla de nuevo', async () => {
    mockedListarAsistenciasFamilia.mockResolvedValue([
      {
        id: 'asistencia-1',
        fecha: '2027-03-15',
        tipo: 'ausente_pendiente',
        inscripcion_id: 'inscripcion-1',
        updated_at: '2027-03-15T08:00:00',
        justificacion_id: 'justificacion-1',
        justificacion_estado: 'pendiente',
        justificacion_motivo: 'Enfermedad',
        justificacion_observacion: 'Se adjunta certificado.',
        justificacion_archivo_nombre: null,
      },
    ])

    render(
      <MemoryRouter>
        <PortalFamiliaTramitePage
          titulo="Justificar una ausencia"
          descripcion="Informá el motivo de la ausencia."
        />
      </MemoryRouter>,
    )

    expect(
      await screen.findByText('No tenés ausencias pendientes de justificar.'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Historial' }))
    expect(await screen.findByText('En revisión')).toBeInTheDocument()
    expect(screen.getByLabelText('Pendiente de aprobación')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Justificar' })).not.toBeInTheDocument()
  })

  it('separa pendientes del historial y despliega el detalle de una justificación', async () => {
    mockedListarAsistenciasFamilia.mockResolvedValue([
      {
        id: 'asistencia-pendiente',
        fecha: '2027-03-15',
        tipo: 'ausente_pendiente',
        inscripcion_id: 'inscripcion-1',
        updated_at: '2027-03-15T08:00:00',
        justificacion_id: null,
        justificacion_estado: null,
        justificacion_motivo: null,
        justificacion_observacion: null,
        justificacion_archivo_nombre: null,
      },
      {
        id: 'asistencia-aprobada',
        fecha: '2027-03-14',
        tipo: 'ausente_pendiente',
        inscripcion_id: 'inscripcion-1',
        updated_at: '2027-03-14T08:00:00',
        justificacion_id: 'justificacion-1',
        justificacion_estado: 'aprobada',
        justificacion_motivo: 'Enfermedad',
        justificacion_observacion: 'Se adjunta certificado.',
        justificacion_archivo_nombre: 'certificado.pdf',
      },
      {
        id: 'asistencia-presente',
        fecha: '2027-03-13',
        tipo: 'presente',
        inscripcion_id: 'inscripcion-1',
        updated_at: '2027-03-13T08:00:00',
        justificacion_id: null,
        justificacion_estado: null,
        justificacion_motivo: null,
        justificacion_observacion: null,
        justificacion_archivo_nombre: null,
      },
      {
        id: 'asistencia-rechazada',
        fecha: '2027-03-12',
        tipo: 'ausente_pendiente',
        inscripcion_id: 'inscripcion-1',
        updated_at: '2027-03-12T08:00:00',
        justificacion_id: 'justificacion-2',
        justificacion_estado: 'rechazada',
        justificacion_motivo: 'Otro',
        justificacion_observacion: 'Falta documentación.',
        justificacion_archivo_nombre: null,
      },
    ])

    render(
      <MemoryRouter>
        <PortalFamiliaTramitePage
          titulo="Justificar una ausencia"
          descripcion="Informá el motivo de la ausencia."
        />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Pendientes' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Historial' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Pendientes' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Historial' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('button', { name: 'Justificar' })).toBeInTheDocument()

    const botonJustificar = await screen.findByRole(
      'button',
      { name: 'Justificar' },
      { timeout: 3000 },
    )
    fireEvent.click(botonJustificar)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Justificar ausencia' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Historial' }))
    expect(screen.getByRole('heading', { name: 'Historial' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Historial' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Justificación aprobada')).toBeInTheDocument()
    expect(screen.getByLabelText('Aprobada')).toBeInTheDocument()
    expect(screen.getByText('Justificación rechazada')).toBeInTheDocument()
    expect(screen.getByLabelText('Rechazada')).toBeInTheDocument()
    expect(screen.getByText('Presente')).toBeInTheDocument()
    expect(screen.queryByText('Se adjunta certificado.')).not.toBeVisible()

    const disclosure = screen.getByRole('button', {
      name: 'Mostrar detalle de la justificación del 14/3/2027',
    })
    expect(disclosure).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(disclosure)
    expect(disclosure).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Se adjunta certificado.')).toBeVisible()
    expect(screen.getByText('certificado.pdf')).toBeVisible()
  })

  it('muestra el resumen y las tres secciones dentro de Asistencias', async () => {
    mockedListarAsistenciasFamilia.mockResolvedValue([
      {
        id: 'asistencia-presente',
        fecha: '2027-03-15',
        tipo: 'presente',
        inscripcion_id: 'inscripcion-1',
        updated_at: '2027-03-15T08:00:00',
        justificacion_id: null,
        justificacion_estado: null,
        justificacion_motivo: null,
        justificacion_observacion: null,
        justificacion_archivo_nombre: null,
      },
      {
        id: 'asistencia-tardanza',
        fecha: '2027-03-14',
        tipo: 'tardanza',
        inscripcion_id: 'inscripcion-1',
        updated_at: '2027-03-14T08:00:00',
        justificacion_id: null,
        justificacion_estado: null,
        justificacion_motivo: null,
        justificacion_observacion: null,
        justificacion_archivo_nombre: null,
      },
      {
        id: 'asistencia-ausente',
        fecha: '2027-03-13',
        tipo: 'ausente_justificado',
        inscripcion_id: 'inscripcion-1',
        updated_at: '2027-03-13T08:00:00',
        justificacion_id: 'justificacion-1',
        justificacion_estado: 'aprobada',
        justificacion_motivo: 'Enfermedad',
        justificacion_observacion: 'Certificado presentado.',
        justificacion_archivo_nombre: null,
      },
    ])

    render(
      <MemoryRouter>
        <PortalFamiliaTramitePage titulo="Asistencias" descripcion="Consultá tus asistencias." />
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('heading', { name: 'Resumen de asistencia' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Consultá tus asistencias.')).not.toBeInTheDocument()
    const selectorAlumno = screen.getByLabelText('Alumno')
    expect(selectorAlumno).toHaveTextContent('Juan Gómez')
    expect(selectorAlumno.closest('[data-slot="portal-familia-shell"]')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Resumen' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Justificar asistencia' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Historial' })).toBeInTheDocument()

    const resumen = screen.getByRole('tabpanel', { name: 'Resumen' })
    const presentes = within(resumen).getByText('Asistencias').closest('article')
    const inasistencias = within(resumen).getByText('Inasistencias').closest('article')
    const tardanzas = within(resumen).getByText('Tardanzas').closest('article')
    expect(within(presentes!).getByText('1')).toBeInTheDocument()
    expect(within(inasistencias!).getByText('1', { selector: 'p' })).toBeInTheDocument()
    expect(within(inasistencias!).getByText('1 justificada')).toBeInTheDocument()
    expect(within(tardanzas!).getByText('1')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Justificar asistencia' }))
    expect(screen.getByRole('heading', { name: 'Justificar asistencia' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Historial' }))
    expect(screen.getByRole('heading', { name: 'Historial' })).toBeInTheDocument()
  })

  it('filtra y ordena el historial por fecha y tipo', async () => {
    mockedListarAsistenciasFamilia.mockResolvedValue([
      {
        id: 'asistencia-presente',
        fecha: '2027-03-15',
        tipo: 'presente',
        inscripcion_id: 'inscripcion-1',
        updated_at: '2027-03-15T08:00:00',
        justificacion_id: null,
        justificacion_estado: null,
        justificacion_motivo: null,
        justificacion_observacion: null,
        justificacion_archivo_nombre: null,
      },
      {
        id: 'asistencia-tardanza',
        fecha: '2027-03-14',
        tipo: 'tardanza',
        inscripcion_id: 'inscripcion-1',
        updated_at: '2027-03-14T08:00:00',
        justificacion_id: null,
        justificacion_estado: null,
        justificacion_motivo: null,
        justificacion_observacion: null,
        justificacion_archivo_nombre: null,
      },
      {
        id: 'asistencia-inasistencia',
        fecha: '2027-03-13',
        tipo: 'ausente_injustificado',
        inscripcion_id: 'inscripcion-1',
        updated_at: '2027-03-13T08:00:00',
        justificacion_id: null,
        justificacion_estado: null,
        justificacion_motivo: null,
        justificacion_observacion: null,
        justificacion_archivo_nombre: null,
      },
      crearAsistencia({ id: 'asistencia-presente-2', fecha: '2027-03-12' }),
      crearAsistencia({ id: 'asistencia-tardanza-2', fecha: '2027-03-11', tipo: 'tardanza' }),
      crearAsistencia({
        id: 'asistencia-inasistencia-2',
        fecha: '2027-03-10',
        tipo: 'ausente_injustificado',
      }),
    ])

    render(
      <MemoryRouter>
        <PortalFamiliaTramitePage titulo="Asistencias" descripcion="Consultá tus asistencias." />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: 'Resumen de asistencia' })
    fireEvent.click(screen.getByRole('tab', { name: 'Historial' }))
    const historial = screen.getByRole('tabpanel', { name: 'Historial' })
    expect(within(historial).getByText('15/3/2027')).toBeInTheDocument()
    expect(within(historial).getByText('14/3/2027')).toBeInTheDocument()
    expect(within(historial).getByText('13/3/2027')).toBeInTheDocument()
    expect(within(historial).queryByText('10/3/2027')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(within(historial).getByText('10/3/2027')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2027-03-14' } })
    expect(within(historial).getByText('15/3/2027')).toBeInTheDocument()
    expect(within(historial).getByText('14/3/2027')).toBeInTheDocument()
    expect(within(historial).queryByText('13/3/2027')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('combobox', { name: 'Tipo' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Tardanzas' }))
    expect(within(historial).getByText('14/3/2027')).toBeInTheDocument()
    expect(within(historial).queryByText('15/3/2027')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('combobox', { name: 'Ordenar por fecha' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Ascendente' }))
    expect(screen.getByRole('combobox', { name: 'Ordenar por fecha' })).toHaveTextContent(
      'Ascendente',
    )
  })

  it('oculta Justificar si una solicitud cubre la fecha y permite cancelarla', async () => {
    mockedListarAsistenciasFamilia.mockResolvedValue([
      crearAsistencia({
        id: 'asistencia-cubierta',
        fecha: '2027-03-15',
        tipo: 'ausente_pendiente',
      }),
    ])
    mockedListarSolicitudesFamilia.mockResolvedValue([
      {
        id: 'solicitud-1',
        alumno_id: 'alumno-1',
        fecha_inicio: '2027-03-15',
        fecha_fin: '2027-03-15',
        estado: 'pendiente',
        motivo: 'enfermedad',
        observacion: null,
        observacion_resolucion: null,
        archivo_nombre: null,
        fecha_carga: '2027-03-15T08:00:00',
        fecha_resolucion: null,
      },
    ])
    render(
      <MemoryRouter>
        <PortalFamiliaTramitePage titulo="Asistencias" descripcion="Consultá tus asistencias." />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: 'Resumen de asistencia' })
    expect(screen.queryByText('Tenés una ausencia pendiente')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Justificar asistencia' }))
    expect(
      await screen.findByText('No tenés ausencias pendientes de justificar.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Justificar' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Historial' }))
    expect(await screen.findByText('Cubierta por solicitud')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Solicitudes' }))
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await vi.waitFor(() => expect(mockedCancelarSolicitud).toHaveBeenCalledWith('solicitud-1'))
    confirmar.mockRestore()
  })

  it('abre el formulario compartido desde Informar ausencia', async () => {
    mockedListarAsistenciasFamilia.mockResolvedValue([])
    render(
      <MemoryRouter>
        <PortalFamiliaTramitePage titulo="Asistencias" descripcion="Consultá tus asistencias." />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: 'Resumen de asistencia' })
    fireEvent.click(screen.getByRole('button', { name: 'Informar ausencia' }))

    expect(screen.getByRole('heading', { name: 'Informar ausencia' })).toBeInTheDocument()
    expect(screen.getByLabelText('Desde')).toBeInTheDocument()
  })

  it('indica el envío pendiente y conserva el formulario con un error visible si falla', async () => {
    mockedListarAsistenciasFamilia.mockResolvedValue([])
    let rechazar!: (error: Error) => void
    mockedCrearSolicitud.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rechazar = reject
        }),
    )
    render(
      <MemoryRouter>
        <PortalFamiliaTramitePage titulo="Asistencias" descripcion="Consultá tus asistencias." />
      </MemoryRouter>,
    )
    await screen.findByRole('heading', { name: 'Resumen de asistencia' })
    fireEvent.click(screen.getByRole('button', { name: 'Informar ausencia' }))
    const dialogo = within(screen.getByRole('dialog'))
    fireEvent.change(dialogo.getByLabelText('Desde'), { target: { value: '2026-12-05' } })
    fireEvent.click(dialogo.getByRole('combobox', { name: 'Motivo' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Enfermedad' }))
    fireEvent.click(dialogo.getByRole('button', { name: 'Informar ausencia' }))

    expect(dialogo.getByRole('status', { name: 'Enviando solicitud' })).toBeInTheDocument()
    expect(dialogo.getByRole('button', { name: /Informar ausencia/ })).toBeDisabled()
    expect(mockedCrearSolicitud).toHaveBeenCalledWith({
      alumno_id: 'alumno-1',
      fecha_inicio: '2026-12-05',
      fecha_fin: undefined,
      motivo: 'enfermedad',
      observacion: undefined,
      comprobante: undefined,
    })
    await act(async () => {
      rechazar(new Error('Network unavailable'))
    })
    expect(dialogo.getByRole('alert')).toHaveTextContent(
      'No se pudo enviar la solicitud. Intentá de nuevo.',
    )
    expect(dialogo.getByLabelText('Desde')).toHaveValue('2026-12-05')
    expect(dialogo.getByRole('button', { name: 'Informar ausencia' })).toBeEnabled()
    expect(dialogo.queryByRole('status')).not.toBeInTheDocument()
  })

  describe('ventana de justificación de 45 días', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      // Mediodía en Buenos Aires: el día operativo argentino es el 13/11/2026.
      vi.setSystemTime(new Date('2026-11-13T15:00:00Z'))
      useCicloLectivoStore.setState({ cicloLectivo: '2026' })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('limita la justificación a los últimos 45 días y bloquea una ausencia vieja', async () => {
      mockedListarAsistenciasFamilia.mockResolvedValue([
        crearAsistencia({
          id: 'asistencia-vieja',
          fecha: '2026-09-28',
          tipo: 'ausente_pendiente',
        }),
      ])

      render(
        <MemoryRouter>
          <PortalFamiliaTramitePage
            titulo="Justificar una ausencia"
            descripcion="Informá el motivo de la ausencia."
          />
        </MemoryRouter>,
      )

      await screen.findByRole('heading', { name: 'Pendientes' })
      const botonJustificar = await screen.findByRole(
        'button',
        { name: 'Justificar' },
        { timeout: 3000 },
      )
      fireEvent.click(botonJustificar)

      const dialogo = within(screen.getByRole('dialog'))
      expect(
        dialogo.getByText('Solo podés justificar ausencias de los últimos 45 días.'),
      ).toBeInTheDocument()
      expect(
        dialogo.getByText('La fecha debe estar dentro de los últimos 45 días.'),
      ).toBeInTheDocument()
      const desde = dialogo.getByLabelText('Fecha de la ausencia')
      expect(desde).toHaveValue('2026-09-28')
      expect(desde).toHaveAttribute('min', '2026-09-29')
      expect(desde).toHaveAttribute('max', '2026-11-13')
      expect(dialogo.getByRole('button', { name: 'Enviar justificación' })).toBeDisabled()
    })

    it('usa el límite configurado en el rango de fechas y el texto de ayuda', async () => {
      mockedObtenerConfiguracion.mockResolvedValue({ dias_limite_justificacion: 10 })
      mockedListarAsistenciasFamilia.mockResolvedValue([
        crearAsistencia({
          id: 'asistencia-fuera-del-limite-configurado',
          fecha: '2026-10-30',
          tipo: 'ausente_pendiente',
        }),
      ])

      render(
        <MemoryRouter>
          <PortalFamiliaTramitePage
            titulo="Justificar una ausencia"
            descripcion="Informá el motivo de la ausencia."
          />
        </MemoryRouter>,
      )

      await screen.findByRole('heading', { name: 'Pendientes' })
      const botonJustificar = await screen.findByRole(
        'button',
        { name: 'Justificar' },
        { timeout: 3000 },
      )
      fireEvent.click(botonJustificar)

      const dialogo = within(screen.getByRole('dialog'))
      expect(
        await dialogo.findByText('Solo podés justificar ausencias de los últimos 10 días.'),
      ).toBeInTheDocument()
      expect(dialogo.getByLabelText('Fecha de la ausencia')).toHaveAttribute('min', '2026-11-03')
      expect(
        dialogo.getByText('La fecha debe estar dentro de los últimos 10 días.'),
      ).toBeInTheDocument()
      expect(dialogo.getByRole('button', { name: 'Enviar justificación' })).toBeDisabled()
    })

    it('bloquea una justificación con fecha futura', async () => {
      mockedListarAsistenciasFamilia.mockResolvedValue([
        crearAsistencia({
          id: 'asistencia-futura',
          fecha: '2026-11-20',
          tipo: 'ausente_pendiente',
        }),
      ])

      render(
        <MemoryRouter>
          <PortalFamiliaTramitePage
            titulo="Justificar una ausencia"
            descripcion="Informá el motivo de la ausencia."
          />
        </MemoryRouter>,
      )

      await screen.findByRole('heading', { name: 'Pendientes' })
      const botonJustificar = await screen.findByRole(
        'button',
        { name: 'Justificar' },
        { timeout: 3000 },
      )
      fireEvent.click(botonJustificar)

      const dialogo = within(screen.getByRole('dialog'))
      expect(
        dialogo.getByText('La fecha debe estar dentro de los últimos 45 días.'),
      ).toBeInTheDocument()
      expect(dialogo.getByLabelText('Fecha de la ausencia')).toHaveAttribute('max', '2026-11-13')
      expect(dialogo.getByRole('button', { name: 'Enviar justificación' })).toBeDisabled()
    })

    it('permite justificar una ausencia dentro de los últimos 45 días', async () => {
      mockedListarAsistenciasFamilia.mockResolvedValue([
        crearAsistencia({
          id: 'asistencia-reciente',
          fecha: '2026-10-30',
          tipo: 'ausente_pendiente',
        }),
      ])
      mockedCrearSolicitud.mockResolvedValue({} as never)

      render(
        <MemoryRouter>
          <PortalFamiliaTramitePage
            titulo="Justificar una ausencia"
            descripcion="Informá el motivo de la ausencia."
          />
        </MemoryRouter>,
      )

      await screen.findByRole('heading', { name: 'Pendientes' })
      const botonJustificar = await screen.findByRole(
        'button',
        { name: 'Justificar' },
        { timeout: 3000 },
      )
      fireEvent.click(botonJustificar)

      const dialogo = within(screen.getByRole('dialog'))
      expect(
        dialogo.queryByText('La fecha debe estar dentro de los últimos 45 días.'),
      ).not.toBeInTheDocument()
      fireEvent.click(dialogo.getByRole('combobox', { name: 'Motivo' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Enfermedad' }))
      const enviar = dialogo.getByRole('button', { name: 'Enviar justificación' })
      expect(enviar).toBeEnabled()
      fireEvent.click(enviar)

      await vi.waitFor(() =>
        expect(mockedCrearSolicitud).toHaveBeenCalledWith(
          expect.objectContaining({ fecha_inicio: '2026-10-30', motivo: 'enfermedad' }),
        ),
      )
    })

    it('mantiene la validación de fecha final anterior a la inicial', async () => {
      mockedListarAsistenciasFamilia.mockResolvedValue([
        crearAsistencia({
          id: 'asistencia-rango',
          fecha: '2026-11-10',
          tipo: 'ausente_pendiente',
        }),
      ])

      render(
        <MemoryRouter>
          <PortalFamiliaTramitePage
            titulo="Justificar una ausencia"
            descripcion="Informá el motivo de la ausencia."
          />
        </MemoryRouter>,
      )

      await screen.findByRole('heading', { name: 'Pendientes' })
      const botonJustificar = await screen.findByRole(
        'button',
        { name: 'Justificar' },
        { timeout: 3000 },
      )
      fireEvent.click(botonJustificar)

      const dialogo = within(screen.getByRole('dialog'))
      fireEvent.change(dialogo.getByLabelText(/^Hasta/), { target: { value: '2026-11-05' } })
      expect(
        dialogo.getByText('La fecha final no puede ser anterior a la inicial.'),
      ).toBeInTheDocument()
      fireEvent.click(dialogo.getByRole('combobox', { name: 'Motivo' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Enfermedad' }))
      expect(dialogo.getByRole('button', { name: 'Enviar justificación' })).toBeDisabled()
    })

    it('mantiene el aviso de ausencia dentro del ciclo lectivo', async () => {
      mockedListarAsistenciasFamilia.mockResolvedValue([])
      mockedCrearSolicitud.mockResolvedValue({} as never)

      render(
        <MemoryRouter>
          <PortalFamiliaTramitePage titulo="Asistencias" descripcion="Consultá tus asistencias." />
        </MemoryRouter>,
      )

      await screen.findByRole('heading', { name: 'Resumen de asistencia' })
      fireEvent.click(screen.getByRole('button', { name: 'Informar ausencia' }))

      const dialogo = within(screen.getByRole('dialog'))
      expect(
        dialogo.getByText('Informá una fecha o un período desde hoy y dentro del ciclo lectivo.'),
      ).toBeInTheDocument()
      const desde = dialogo.getByLabelText('Desde')
      expect(desde).toHaveAttribute('min', '2026-11-13')
      expect(desde).toHaveAttribute('max', '2026-12-31')
      expect(dialogo.getByLabelText(/^Hasta/)).toHaveAttribute('max', '2026-12-31')
      expect(dialogo.queryByText('La fecha debe estar dentro de los últimos 45 días.')).toBeNull()

      fireEvent.change(desde, { target: { value: '2026-12-01' } })
      fireEvent.click(dialogo.getByRole('combobox', { name: 'Motivo' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Enfermedad' }))
      fireEvent.click(dialogo.getByRole('button', { name: 'Informar ausencia' }))

      await vi.waitFor(() =>
        expect(mockedCrearSolicitud).toHaveBeenCalledWith(
          expect.objectContaining({ fecha_inicio: '2026-12-01' }),
        ),
      )
    })

    it('bloquea un aviso de ausencia con fecha del ciclo siguiente', async () => {
      mockedListarAsistenciasFamilia.mockResolvedValue([])

      render(
        <MemoryRouter>
          <PortalFamiliaTramitePage titulo="Asistencias" descripcion="Consultá tus asistencias." />
        </MemoryRouter>,
      )

      await screen.findByRole('heading', { name: 'Resumen de asistencia' })
      fireEvent.click(screen.getByRole('button', { name: 'Informar ausencia' }))

      const dialogo = within(screen.getByRole('dialog'))
      fireEvent.change(dialogo.getByLabelText('Desde'), { target: { value: '2027-01-10' } })
      expect(
        dialogo.getByText('La fecha debe pertenecer al ciclo lectivo actual.'),
      ).toBeInTheDocument()
      fireEvent.click(dialogo.getByRole('combobox', { name: 'Motivo' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Enfermedad' }))
      expect(dialogo.getByRole('button', { name: 'Informar ausencia' })).toBeDisabled()
      expect(mockedCrearSolicitud).not.toHaveBeenCalled()
    })

    it('toma el cierre del ciclo lectivo desde el store compartido', async () => {
      useCicloLectivoStore.setState({ cicloLectivo: '2027' })
      mockedListarAsistenciasFamilia.mockResolvedValue([])

      render(
        <MemoryRouter>
          <PortalFamiliaTramitePage titulo="Asistencias" descripcion="Consultá tus asistencias." />
        </MemoryRouter>,
      )

      await screen.findByRole('heading', { name: 'Resumen de asistencia' })
      fireEvent.click(screen.getByRole('button', { name: 'Informar ausencia' }))

      const dialogo = within(screen.getByRole('dialog'))
      expect(dialogo.getByLabelText('Desde')).toHaveAttribute('max', '2027-12-31')
      expect(dialogo.getByLabelText(/^Hasta/)).toHaveAttribute('max', '2027-12-31')
    })
  })
})
