import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PortalFamiliaTramitePage } from '@/pages/portal-familia-tramite-page'
import { listarAsistenciasFamilia } from '@/modules/academico/services/listar-asistencias-familia'
import { useMisAlumnos } from '@/modules/familias-alumnos/hooks/use-mis-alumnos'
import type { AsistenciaFamilia } from '@/modules/academico/types'

vi.mock('@/modules/academico/services/listar-asistencias-familia')
vi.mock('@/modules/familias-alumnos/hooks/use-mis-alumnos')

const mockedListarAsistenciasFamilia = vi.mocked(listarAsistenciasFamilia)
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

    fireEvent.click(screen.getByRole('button', { name: 'Justificar' }))
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
})
