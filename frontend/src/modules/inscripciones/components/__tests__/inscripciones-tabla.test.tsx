import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { InscripcionesTabla } from '@/modules/inscripciones/components/inscripciones-tabla'
import type { InscripcionListadoItem } from '@/modules/inscripciones/types'

const inscripcionActiva: InscripcionListadoItem = {
  id: 'inscripcion-activa',
  ciclo_lectivo: '2027',
  fecha_inscripcion: '2027-02-25',
  tipo: 'nueva',
  estado: 'activa',
  alumno_id: 'alumno-1',
  alumno_nombre: 'Tiziano',
  alumno_apellido: 'Cabral',
  numero_legajo: 'A-2027-001',
  division_id: 'division-1',
  division_nombre: '4°B',
  anio_numero: 4,
  nivel_educativo_nombre: 'Primario',
}

describe('InscripcionesTabla', () => {
  it('muestra movimientos únicamente para una inscripción activa', async () => {
    const user = userEvent.setup()
    const onCambiarMatricula = vi.fn()
    const onRegistrarBaja = vi.fn()
    render(
      <InscripcionesTabla
        items={[
          inscripcionActiva,
          { ...inscripcionActiva, id: 'inscripcion-finalizada', estado: 'finalizada' },
        ]}
        cargando={false}
        densidad="comfortable"
        pagina={1}
        tamanioPagina={10}
        total={2}
        totalPaginas={1}
        onCambiarPagina={vi.fn()}
        onCambiarMatricula={onCambiarMatricula}
        onRegistrarBaja={onRegistrarBaja}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Acciones para Cabral, Tiziano' }))
    await user.click(screen.getByRole('menuitem', { name: 'Cambio de matrícula' }))

    expect(onCambiarMatricula).toHaveBeenCalledWith(inscripcionActiva)
    expect(screen.getAllByLabelText('Sin acciones disponibles')).toHaveLength(1)
    expect(onRegistrarBaja).not.toHaveBeenCalled()
  })
})
