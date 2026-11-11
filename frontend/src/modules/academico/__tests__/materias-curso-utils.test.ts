import { describe, expect, it } from 'vitest'
import type { MateriaCurso } from '@/modules/academico/types'
import {
  coincideFiltroHorario,
  FILTRO_HORARIO_INICIAL,
  FILTRO_MATERIAS_INICIAL,
  filtrarYOrdenarMaterias,
  franjasOcupadas,
  idsEnConflicto,
  materiasEnConflicto,
  SIN_DOCENTE,
} from '@/modules/academico/utils'

function materia(
  id: string,
  nombre: string,
  horarios: [number, string, string][] = [],
  tipo: 'materia' | 'taller' = 'materia',
): MateriaCurso {
  return {
    id,
    materia_id: `m-${id}`,
    materia_nombre: nombre,
    materia_tipo: tipo,
    materia_color: null,
    division_id: 'd1',
    division_nombre: '1°A',
    anio_id: 'a1',
    anio_numero: 1,
    nivel_educativo_id: 'n1',
    nivel_educativo_nombre: 'Primario',
    horarios: horarios.map(([dia_semana, hora_inicio, hora_fin], i) => ({
      id: `${id}-${i}`,
      dia_semana,
      hora_inicio,
      hora_fin,
    })),
    cantidad_asignaciones: 0,
    created_at: '',
    updated_at: '',
  }
}

const lengua = materia('1', 'Lengua', [[2, '09:00', '10:00']])
const arte = materia('2', 'Arte', [[1, '08:00', '09:00']], 'taller')
const mate = materia('3', 'Matemática', [[2, '09:30', '10:30']])
const sinHorario = materia('4', 'Biología')
const todas = [lengua, arte, mate, sinHorario]

const nombres = (items: MateriaCurso[]) => items.map((item) => item.materia_nombre)

describe('materiasEnConflicto', () => {
  it('lista las materias que se pisan con la dada', () => {
    expect(materiasEnConflicto(lengua, todas)).toEqual(['Matemática'])
    expect(materiasEnConflicto(mate, todas)).toEqual(['Lengua'])
  })

  it('franjas contiguas no se consideran conflicto', () => {
    const contigua = materia('5', 'Ciencias', [[2, '10:00', '11:00']])
    expect(materiasEnConflicto(lengua, [lengua, contigua])).toEqual([])
  })

  it('una materia sin horario no tiene conflictos', () => {
    expect(materiasEnConflicto(sinHorario, todas)).toEqual([])
  })
})

describe('filtrarYOrdenarMaterias', () => {
  const sinDocentes = () => 0

  it('ordena por nombre ignorando acentos', () => {
    const resultado = filtrarYOrdenarMaterias(todas, FILTRO_MATERIAS_INICIAL, sinDocentes)
    expect(nombres(resultado)).toEqual(['Arte', 'Biología', 'Lengua', 'Matemática'])
  })

  it('busca sin importar mayúsculas ni acentos', () => {
    const resultado = filtrarYOrdenarMaterias(
      todas,
      { ...FILTRO_MATERIAS_INICIAL, texto: 'MATEMATICA' },
      sinDocentes,
    )
    expect(nombres(resultado)).toEqual(['Matemática'])
  })

  it('filtra por tipo', () => {
    const resultado = filtrarYOrdenarMaterias(
      todas,
      { ...FILTRO_MATERIAS_INICIAL, tipo: 'taller' },
      sinDocentes,
    )
    expect(nombres(resultado)).toEqual(['Arte'])
  })

  it('ordena por día con las materias sin horario al final', () => {
    const resultado = filtrarYOrdenarMaterias(
      todas,
      { ...FILTRO_MATERIAS_INICIAL, orden: 'dia' },
      sinDocentes,
    )
    expect(nombres(resultado)).toEqual(['Arte', 'Lengua', 'Matemática', 'Biología'])
  })

  it('pone primero las materias sin docente', () => {
    const resultado = filtrarYOrdenarMaterias(
      todas,
      { ...FILTRO_MATERIAS_INICIAL, orden: 'sin-docente' },
      (materiaCurso) => (materiaCurso.id === '3' ? 0 : 1),
    )
    expect(nombres(resultado)[0]).toBe('Matemática')
    expect(nombres(resultado).slice(1)).toEqual(['Arte', 'Biología', 'Lengua'])
  })
})

describe('franjasOcupadas', () => {
  it('junta las franjas de todas las materias con su nombre', () => {
    expect(franjasOcupadas([lengua, arte])).toEqual([
      { materia: 'Lengua', dia_semana: 2, hora_inicio: '09:00', hora_fin: '10:00' },
      { materia: 'Arte', dia_semana: 1, hora_inicio: '08:00', hora_fin: '09:00' },
    ])
  })

  it('deja afuera la materia que se está editando', () => {
    expect(franjasOcupadas([lengua, arte], lengua.id).map((franja) => franja.materia)).toEqual([
      'Arte',
    ])
  })
})

describe('coincideFiltroHorario', () => {
  it('sin filtro deja pasar todo', () => {
    expect(coincideFiltroHorario(lengua, FILTRO_HORARIO_INICIAL, [])).toBe(true)
  })

  it('filtra por texto sin tildes ni mayúsculas y por tipo', () => {
    expect(
      coincideFiltroHorario(mate, { ...FILTRO_HORARIO_INICIAL, texto: 'matematica' }, []),
    ).toBe(true)
    expect(coincideFiltroHorario(arte, { ...FILTRO_HORARIO_INICIAL, tipo: 'materia' }, [])).toBe(
      false,
    )
  })

  it('filtra por docente y por "sin docente"', () => {
    const conAna = { ...FILTRO_HORARIO_INICIAL, docente: 'Ana Pérez' }
    expect(coincideFiltroHorario(lengua, conAna, ['Ana Pérez'])).toBe(true)
    expect(coincideFiltroHorario(lengua, conAna, ['Luis Gómez'])).toBe(false)
    const sinDocente = { ...FILTRO_HORARIO_INICIAL, docente: SIN_DOCENTE }
    expect(coincideFiltroHorario(lengua, sinDocente, [])).toBe(true)
    expect(coincideFiltroHorario(lengua, sinDocente, ['Ana Pérez'])).toBe(false)
  })
})

describe('idsEnConflicto', () => {
  it('devuelve las materias que se pisan entre sí', () => {
    expect(idsEnConflicto(todas)).toEqual(new Set(['1', '3']))
  })
})
