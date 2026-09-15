import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PortalFamiliaTramitePage } from '@/pages/portal-familia-tramite-page'
import { listarAsistenciasFamilia } from '@/modules/academico/services/listar-asistencias-familia'
import { useMisAlumnos } from '@/modules/familias-alumnos/hooks/use-mis-alumnos'

vi.mock('@/modules/academico/services/listar-asistencias-familia')
vi.mock('@/modules/familias-alumnos/hooks/use-mis-alumnos')

const mockedListarAsistenciasFamilia = vi.mocked(listarAsistenciasFamilia)
const mockedUseMisAlumnos = vi.mocked(useMisAlumnos)

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
    expect(screen.queryByRole('button', { name: 'Justificar' })).not.toBeInTheDocument()
  })
})
