import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import type { EventoCalendario } from '@/modules/comunicaciones/types'
import type { MateriaCurso } from '../../types'
import { GrillaSemanal, type Actividad } from '../grilla-semanal'

const semana = [16, 17, 18, 19, 20].map((dia) => new Date(2026, 10, dia))

function materia(nombre: string): MateriaCurso {
  return {
    id: `mc-${nombre}`,
    materia_id: `m-${nombre}`,
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
    docentes: [],
    cantidad_asignaciones: 0,
    created_at: '2026-01-01T00:00:00',
    updated_at: '2026-01-01T00:00:00',
  }
}

function clase(id: string, dia: number, inicio: number, fin: number): Actividad {
  const curso = materia('Matemática')
  return {
    tipo: 'clase',
    id,
    dia,
    inicio,
    fin,
    franja: {
      id: `franja-${id}`,
      dia_semana: dia,
      hora_inicio: `${String(Math.floor(inicio / 60)).padStart(2, '0')}:${String(inicio % 60).padStart(2, '0')}`,
      hora_fin: `${String(Math.floor(fin / 60)).padStart(2, '0')}:${String(fin % 60).padStart(2, '0')}`,
      materia: curso,
    },
  }
}

function evento(
  id: string,
  dia: number,
  inicio: number | null,
  fin: number | null,
  titulo = 'Reunión de padres',
): Actividad {
  const calendario: EventoCalendario = {
    comunicacion_id: `c-${id}`,
    titulo,
    fecha: `2026-11-${String(15 + dia).padStart(2, '0')}`,
    hora_inicio:
      inicio === null
        ? null
        : `${String(Math.floor(inicio / 60)).padStart(2, '0')}:${String(inicio % 60).padStart(2, '0')}`,
    hora_fin:
      fin === null
        ? null
        : `${String(Math.floor(fin / 60)).padStart(2, '0')}:${String(fin % 60).padStart(2, '0')}`,
    lugar: 'Biblioteca',
    descripcion: '',
  }
  return { tipo: 'evento', id, dia, inicio: inicio ?? 0, fin: fin ?? 60, evento: calendario }
}

function renderizar(actividades: Actividad[], rango = { inicio: 480, fin: 600 }) {
  return render(
    <GrillaSemanal
      semana={semana}
      diaActivo={1}
      hoyISO={new Date(2026, 10, 16).toDateString()}
      rango={rango}
      actividades={actividades}
      seleccionId={null}
      onSeleccionarClase={vi.fn()}
      onSeleccionarEvento={vi.fn()}
      onVerGrupo={vi.fn()}
    />,
  )
}

const posicion = (elemento: HTMLElement) => ({
  top: elemento.style.top,
  height: elemento.style.height,
  left: elemento.style.left,
  width: elemento.style.width,
})

it('renders an event without overlap at full width next to the class', () => {
  renderizar([clase('c1', 1, 480, 540), evento('e1', 2, 480, 540)])

  const botonClase = screen.getByRole('button', { name: /Matemática/ })
  const botonEvento = screen.getByRole('button', { name: /Reunión de padres/ })
  expect(posicion(botonClase)).toEqual({ top: '0%', height: '50%', left: '0%', width: '100%' })
  expect(posicion(botonEvento)).toEqual({ top: '0%', height: '50%', left: '0%', width: '100%' })
})

it('splits a partial overlap into two columns and keeps both durations', () => {
  renderizar([clase('c1', 1, 480, 540), evento('e1', 1, 510, 570)], { inicio: 480, fin: 570 })

  const botones = screen.getAllByRole('button')
  const claseBoton = botones.find((boton) => boton.textContent?.includes('Matemática'))!
  const eventoBoton = botones.find((boton) => boton.textContent?.includes('Reunión de padres'))!
  expect(posicion(claseBoton)).toEqual({
    top: '0%',
    height: '66.66666666666666%',
    left: '0%',
    width: '50%',
  })
  expect(posicion(eventoBoton).left).toBe('50%')
  expect(posicion(eventoBoton).width).toBe('50%')
  expect(posicion(eventoBoton).top).toBe('33.33333333333333%')
})

it('shows a total overlap side by side at half width each', () => {
  renderizar([clase('c1', 1, 480, 540), evento('e1', 1, 480, 540)], { inicio: 480, fin: 540 })

  const claseBoton = screen.getByRole('button', { name: /Matemática/ })
  const eventoBoton = screen.getByRole('button', { name: /Reunión de padres/ })
  expect(posicion(claseBoton)).toEqual({ top: '0%', height: '100%', left: '0%', width: '50%' })
  expect(posicion(eventoBoton)).toEqual({ top: '0%', height: '100%', left: '50%', width: '50%' })
})

it('summarizes three simultaneous activities behind a “+N más” control', async () => {
  const usuario = userEvent.setup()
  const onVerGrupo = vi.fn()
  render(
    <GrillaSemanal
      semana={semana}
      diaActivo={1}
      hoyISO={new Date(2026, 10, 16).toDateString()}
      rango={{ inicio: 480, fin: 540 }}
      actividades={[clase('c1', 1, 480, 540), clase('c2', 1, 480, 540), evento('e1', 1, 480, 540)]}
      seleccionId={null}
      onSeleccionarClase={vi.fn()}
      onSeleccionarEvento={vi.fn()}
      onVerGrupo={onVerGrupo}
    />,
  )

  expect(screen.queryByRole('button', { name: /Reunión de padres/ })).not.toBeInTheDocument()
  const resumen = screen.getByRole('button', { name: '+1 más' })
  expect(posicion(resumen)).toEqual({
    top: '0%',
    height: '100%',
    left: '66.66666666666666%',
    width: '33.33333333333333%',
  })
  await usuario.click(resumen)
  expect(onVerGrupo).toHaveBeenCalledTimes(1)
})

it('positions an evening event outside the school day using the expanded range', () => {
  renderizar([evento('e1', 5, 1080, 1145)], { inicio: 450, fin: 1170 })

  const boton = screen.getByRole('button', { name: /Reunión de padres/ })
  const { top, height, left, width } = posicion(boton)
  expect(top).toBe('87.5%')
  expect(Number.parseFloat(height)).toBeCloseTo(9.0278, 3)
  expect(left).toBe('0%')
  expect(width).toBe('100%')
})

it('keeps an event that spans several half-hour slots at its real duration', () => {
  renderizar([evento('e1', 1, 495, 615)], { inicio: 450, fin: 630 })

  const boton = screen.getByRole('button', { name: /Reunión de padres/ })
  expect(posicion(boton)).toEqual({
    top: '25%',
    height: '66.66666666666666%',
    left: '0%',
    width: '100%',
  })
})

it('keeps the class detail selectable while an event overlaps', async () => {
  const usuario = userEvent.setup()
  const onSeleccionarClase = vi.fn()
  const onSeleccionarEvento = vi.fn()
  render(
    <GrillaSemanal
      semana={semana}
      diaActivo={1}
      hoyISO={new Date(2026, 10, 16).toDateString()}
      rango={{ inicio: 480, fin: 540 }}
      actividades={[clase('c1', 1, 480, 540), evento('e1', 1, 480, 540)]}
      seleccionId={null}
      onSeleccionarClase={onSeleccionarClase}
      onSeleccionarEvento={onSeleccionarEvento}
      onVerGrupo={vi.fn()}
    />,
  )

  await usuario.click(screen.getByRole('button', { name: /Matemática/ }))
  await usuario.click(screen.getByRole('button', { name: /Reunión de padres/ }))
  expect(onSeleccionarClase).toHaveBeenCalledTimes(1)
  expect(onSeleccionarEvento).toHaveBeenCalledTimes(1)
})
