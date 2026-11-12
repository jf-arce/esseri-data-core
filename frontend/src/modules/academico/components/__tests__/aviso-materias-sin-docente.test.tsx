import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AvisoMateriasSinDocente } from '@/modules/academico/components/aviso-materias-sin-docente'
import type { MateriaSinDocente } from '@/modules/academico/types'

function materia(sobrescritos: Partial<MateriaSinDocente>): MateriaSinDocente {
  return {
    materia_curso_id: 'mc1',
    materia_id: 'm1',
    materia_nombre: 'Lengua',
    materia_color: '#2563eb',
    division_id: 'd1',
    division_nombre: 'B',
    anio_id: 'a1',
    anio_numero: 4,
    nivel_educativo_id: 'n1',
    nivel_educativo_nombre: 'Primario',
    ...sobrescritos,
  }
}

const materias = [
  materia({}),
  materia({ materia_curso_id: 'mc2', materia_nombre: 'Arte' }),
  materia({
    materia_curso_id: 'mc3',
    materia_nombre: 'Historia',
    division_id: 'd2',
    division_nombre: 'A',
    anio_id: 'a2',
    anio_numero: 1,
    nivel_educativo_id: 'n2',
    nivel_educativo_nombre: 'Secundario',
  }),
]

function montar(props: Partial<Parameters<typeof AvisoMateriasSinDocente>[0]> = {}) {
  const onIrA = vi.fn()
  const onAsignar = vi.fn()
  render(
    <AvisoMateriasSinDocente
      materias={materias}
      ciclo="2026"
      puedeEditar
      onIrA={onIrA}
      onAsignar={onAsignar}
      {...props}
    />,
  )
  return { onIrA, onAsignar }
}

describe('AvisoMateriasSinDocente', () => {
  it('no se muestra si no hay materias sin docente', () => {
    const { container } = render(
      <AvisoMateriasSinDocente
        materias={[]}
        ciclo="2026"
        puedeEditar
        onIrA={vi.fn()}
        onAsignar={vi.fn()}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('cuenta en plural y en singular', () => {
    montar()
    expect(screen.getByRole('button', { name: '3 materias sin docente' })).toBeInTheDocument()
  })

  it('en singular dice "materia"', () => {
    montar({ materias: [materia({})] })
    expect(screen.getByRole('button', { name: '1 materia sin docente' })).toBeInTheDocument()
  })

  it('agrupa por nivel y curso', async () => {
    montar()
    await userEvent.click(screen.getByRole('button', { name: /materias sin docente/ }))

    expect(screen.getByText('Materias sin docente · ciclo 2026')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Primario' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Secundario' })).toBeInTheDocument()
    expect(screen.getByText('4°B')).toBeInTheDocument()
    expect(screen.getByText('1°A')).toBeInTheDocument()
  })

  it('al elegir una materia avisa cuál y se cierra', async () => {
    const { onIrA } = montar()
    await userEvent.click(screen.getByRole('button', { name: /materias sin docente/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Historia' }))

    expect(onIrA).toHaveBeenCalledWith(materias[2])
    expect(screen.queryByText('Materias sin docente · ciclo 2026')).not.toBeInTheDocument()
  })

  it('ofrece "Asignar" solo con permiso de edición', async () => {
    const { onAsignar } = montar()
    await userEvent.click(screen.getByRole('button', { name: /materias sin docente/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Asignar docente a Arte de 4°B' }))
    expect(onAsignar).toHaveBeenCalledWith(materias[1])
  })

  it('sin permiso no hay botón "Asignar"', async () => {
    montar({ puedeEditar: false })
    await userEvent.click(screen.getByRole('button', { name: /materias sin docente/ }))
    expect(screen.queryByRole('button', { name: /Asignar docente/ })).not.toBeInTheDocument()
  })
})
