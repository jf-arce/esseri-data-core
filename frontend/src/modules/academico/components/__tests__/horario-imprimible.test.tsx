import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import type { HorarioMateriaCurso, MateriaCurso } from '../../types'
import { HorarioImprimible } from '../horario-imprimible'

function materia(nombre: string, docentes: string[] = []): MateriaCurso {
  return {
    id: `materia-${nombre}`,
    materia_id: `cat-${nombre}`,
    materia_nombre: nombre,
    materia_tipo: 'materia',
    materia_color: '#2563eb',
    division_id: 'division-1',
    division_nombre: 'B',
    anio_id: 'anio-1',
    anio_numero: 4,
    nivel_educativo_id: 'nivel-1',
    nivel_educativo_nombre: 'Primario',
    horarios: [],
    docentes,
    cantidad_asignaciones: docentes.length,
    created_at: '2026-01-01T00:00:00',
    updated_at: '2026-01-01T00:00:00',
  }
}

function franja(
  slug: string,
  dia_semana: number,
  hora_inicio: string,
  hora_fin: string,
  curso: MateriaCurso,
): HorarioMateriaCurso & { materia: MateriaCurso } {
  return { id: `franja-${slug}`, dia_semana, hora_inicio, hora_fin, materia: curso }
}

it('prints the spreadsheet layout without Saturday when the week has no Saturday classes', () => {
  render(
    <HorarioImprimible
      franjas={[
        franja('mate', 1, '08:00', '09:30', materia('Matemática', ['Pérez, Ana'])),
        franja('lengua', 2, '08:00', '09:00', materia('Lengua', ['Gómez, Luis'])),
      ]}
      division="4°B · Primario"
      cicloLectivo="2026"
    />,
  )

  expect(screen.getByRole('heading', { name: 'Horario de 4°B · Primario' })).toBeInTheDocument()
  expect(screen.getByText(/Ciclo lectivo 2026/)).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Lunes' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Viernes' })).toBeInTheDocument()
  expect(screen.queryByRole('columnheader', { name: 'Sábado' })).not.toBeInTheDocument()
  expect(screen.getAllByText('Matemática').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Pérez, Ana').length).toBeGreaterThan(0)
  expect(screen.getByText('Listado de clases')).toBeInTheDocument()
  expect(screen.getAllByText('08:00').length).toBeGreaterThan(0)
})

it('includes Saturday only when a Saturday class exists', () => {
  render(
    <HorarioImprimible
      franjas={[franja('taller', 6, '09:00', '10:00', materia('Taller de huerta'))]}
      division="4°B"
      cicloLectivo="2026"
    />,
  )

  expect(screen.getByRole('columnheader', { name: 'Hora' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Sábado' })).toBeInTheDocument()
  expect(screen.queryByRole('columnheader', { name: 'Domingo' })).not.toBeInTheDocument()
})

it('prints the same empty message as the spreadsheet when there is no schedule', () => {
  render(<HorarioImprimible franjas={[]} division="4°B" cicloLectivo="2026" />)

  expect(screen.getByText('Todavía no tiene horarios cargados.')).toBeInTheDocument()
})
