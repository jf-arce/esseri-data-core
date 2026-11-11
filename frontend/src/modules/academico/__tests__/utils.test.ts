import { describe, expect, it } from 'vitest'
import {
  abreviarDocentes,
  aMinutos,
  buscarConflictos,
  COLORES_SUGERIDOS,
  colorAleatorio,
  colorMateria,
  hexAleatorio,
  colorTextoLegible,
  normalizarHex,
  calcularGrilla,
  desplazamientoEnMinutos,
  estirarFranja,
  minutosEnPosicion,
  moverFranja,
  particionarSolapados,
  posicionBloque,
  reemplazarFranja,
  deMinutos,
  elegirPorId,
  describirConflicto,
  formatearFranjaLegible,
  formatearHorario,
  formatearHorarios,
  franjaChoca,
  franjasSeSuperponen,
  normalizarTexto,
  primeraFranjaLibre,
} from '../utils'

describe('normalizarTexto', () => {
  it('ignora mayúsculas, acentos y espacios sobrantes', () => {
    expect(normalizarTexto('  JOSÉ  ')).toBe('jose')
    expect(normalizarTexto('Matemática')).toBe('matematica')
    expect(normalizarTexto('  Nivel   Primario ')).toBe('nivel primario')
  })

  it('quita el signo de grado para poder buscar "3c"', () => {
    expect(normalizarTexto('3°C')).toBe('3c')
    expect(normalizarTexto('3ºC')).toBe('3c')
  })
})

describe('formatearHorarios', () => {
  const franja = { dia_semana: 1, hora_inicio: '08:00:00', hora_fin: '09:30:00' }

  it('formatea una franja con día abreviado y horas cortas', () => {
    expect(formatearHorario(franja)).toBe('Lun 08:00–09:30')
  })

  it('une varias franjas y avisa cuando no hay horario', () => {
    expect(
      formatearHorarios([franja, { dia_semana: 3, hora_inicio: '10:00:00', hora_fin: '11:00:00' }]),
    ).toBe('Lun 08:00–09:30 · Mié 10:00–11:00')
    expect(formatearHorarios([])).toBe('Sin horario')
  })

  it('no rompe con un día fuera de rango', () => {
    expect(formatearHorario({ ...franja, dia_semana: 9 })).toBe('Día 9 08:00–09:30')
  })
})

describe('franjasSeSuperponen', () => {
  const base = { dia_semana: 1, hora_inicio: '08:00', hora_fin: '09:00' }

  it('detecta superposición total y parcial', () => {
    expect(franjasSeSuperponen(base, base)).toBe(true)
    expect(franjasSeSuperponen(base, { ...base, hora_inicio: '08:30', hora_fin: '09:30' })).toBe(
      true,
    )
  })

  it('permite franjas contiguas y de otro día', () => {
    expect(franjasSeSuperponen(base, { ...base, hora_inicio: '09:00', hora_fin: '10:00' })).toBe(
      false,
    )
    expect(franjasSeSuperponen(base, { ...base, dia_semana: 2 })).toBe(false)
  })

  it('compara horas con segundos igual que sin ellos', () => {
    expect(
      franjasSeSuperponen(
        { dia_semana: 1, hora_inicio: '08:00:00', hora_fin: '09:00:00' },
        { dia_semana: 1, hora_inicio: '08:30', hora_fin: '09:30' },
      ),
    ).toBe(true)
  })
})

describe('buscarConflictos', () => {
  const ocupadas = [
    { materia: 'Matemática', dia_semana: 1, hora_inicio: '08:00', hora_fin: '09:00' },
  ]

  it('devuelve la materia con la que se pisa', () => {
    const conflictos = buscarConflictos(
      [{ dia_semana: 1, hora_inicio: '08:30', hora_fin: '09:30' }],
      ocupadas,
    )
    expect(conflictos).toHaveLength(1)
    expect(describirConflicto(conflictos[0])).toBe(
      'La franja 1 se superpone con Matemática (Lun 08:00–09:00).',
    )
  })

  it('detecta franjas que se pisan dentro de la misma materia', () => {
    const conflictos = buscarConflictos(
      [
        { dia_semana: 3, hora_inicio: '10:00', hora_fin: '11:00' },
        { dia_semana: 3, hora_inicio: '10:30', hora_fin: '11:30' },
      ],
      [],
    )
    expect(conflictos).toEqual([expect.objectContaining({ indice: 1, materia: null })])
  })

  it('no marca conflicto con franjas contiguas', () => {
    expect(
      buscarConflictos([{ dia_semana: 1, hora_inicio: '09:00', hora_fin: '10:00' }], ocupadas),
    ).toEqual([])
  })
})

describe('elegirPorId', () => {
  const items = [{ id: 'a' }, { id: 'b' }]

  it('devuelve el elemento pedido o el primero si no existe', () => {
    expect(elegirPorId(items, 'b')).toEqual({ id: 'b' })
    expect(elegirPorId(items, 'zzz')).toEqual({ id: 'a' })
    expect(elegirPorId(items, null)).toEqual({ id: 'a' })
    expect(elegirPorId([], 'a')).toBeUndefined()
  })
})

describe('aMinutos y deMinutos', () => {
  it('convierten entre HH:MM y minutos', () => {
    expect(aMinutos('08:30:00')).toBe(510)
    expect(deMinutos(510)).toBe('08:30')
    expect(deMinutos(420)).toBe('07:00')
  })
})

describe('calcularGrilla', () => {
  it('sin franjas muestra lunes a viernes de 07:00 a 14:00 en filas de 30 minutos', () => {
    const grilla = calcularGrilla([])
    expect(grilla.dias).toEqual([1, 2, 3, 4, 5])
    expect(grilla.inicio).toBe(7 * 60)
    expect(grilla.filas).toBe(14)
  })

  it('asigna cada bloque a su día', () => {
    const { bloques } = calcularGrilla([{ dia_semana: 2, hora_inicio: '08:00', hora_fin: '09:30' }])
    expect(bloques[0]).toMatchObject({ dia: 2, superpuesto: false })
  })

  it('agrega sábado solo si hay franjas y amplía el rango horario', () => {
    const grilla = calcularGrilla([
      { dia_semana: 6, hora_inicio: '06:30:00', hora_fin: '15:15:00' },
    ])
    expect(grilla.dias).toEqual([1, 2, 3, 4, 5, 6])
    expect(grilla.inicio).toBe(6 * 60)
    expect(grilla.filas).toBe(20)
    expect(grilla.fin).toBe(16 * 60)
    expect(grilla.bloques[0].dia).toBe(6)
  })

  it('con rango mínimo no achica los días ni las horas', () => {
    const grilla = calcularGrilla([{ dia_semana: 1, hora_inicio: '08:00', hora_fin: '09:00' }], {
      dias: [1, 2, 3, 4, 5, 6],
      inicio: 6 * 60,
      fin: 16 * 60,
    })
    expect(grilla.dias).toEqual([1, 2, 3, 4, 5, 6])
    expect(grilla.inicio).toBe(6 * 60)
    expect(grilla.fin).toBe(16 * 60)
  })

  it('el rango mínimo también puede ampliar la grilla calculada', () => {
    const grilla = calcularGrilla([{ dia_semana: 7, hora_inicio: '20:00', hora_fin: '21:00' }], {
      dias: [1, 2, 3, 4, 5],
      inicio: 7 * 60,
      fin: 14 * 60,
    })
    expect(grilla.dias).toEqual([1, 2, 3, 4, 5, 7])
    expect(grilla.fin).toBe(21 * 60)
  })

  it('marca los bloques que se superponen', () => {
    const { bloques } = calcularGrilla([
      { dia_semana: 1, hora_inicio: '08:00', hora_fin: '09:00' },
      { dia_semana: 1, hora_inicio: '08:30', hora_fin: '09:30' },
      { dia_semana: 1, hora_inicio: '10:00', hora_fin: '11:00' },
    ])
    expect(bloques.map((bloque) => bloque.superpuesto)).toEqual([true, true, false])
  })
})

describe('formatearFranjaLegible', () => {
  it('separa las horas con "a" en vez de guion', () => {
    expect(
      formatearFranjaLegible({ dia_semana: 3, hora_inicio: '10:00:00', hora_fin: '11:30:00' }),
    ).toBe('Mié 10:00 a 11:30')
  })
})

describe('colorMateria y colores sugeridos', () => {
  it('usa el color de la materia con texto legible', () => {
    const color = colorMateria('#1e3a8a')
    expect(color.estilo).toEqual({ backgroundColor: '#1e3a8a', color: '#ffffff' })
    expect(color.estiloBorde).toEqual({ borderLeftColor: '#1e3a8a' })
  })

  it('con un color inválido o ausente usa un gris neutro', () => {
    expect(colorMateria('rojo').estiloBorde).toEqual({ borderLeftColor: '#64748b' })
    expect(colorMateria(null)).toEqual(colorMateria(undefined))
  })

  it('genera hexadecimales válidos al azar', () => {
    for (let i = 0; i < 100; i++) {
      const hex = hexAleatorio()
      expect(normalizarHex(hex)).toBe(hex)
    }
  })

  it('sortea siempre uno de los colores sugeridos, sin rojo', () => {
    for (let i = 0; i < 50; i++) expect(COLORES_SUGERIDOS).toContain(colorAleatorio())
    expect(COLORES_SUGERIDOS.every((hex) => normalizarHex(hex) === hex)).toBe(true)
  })

  it('elige texto negro sobre colores claros y blanco sobre oscuros', () => {
    expect(colorTextoLegible('#fde047')).toBe('#000000')
    expect(colorTextoLegible('#ffffff')).toBe('#000000')
    expect(colorTextoLegible('#000000')).toBe('#ffffff')
    expect(colorTextoLegible('#1e3a8a')).toBe('#ffffff')
  })

  it('normaliza el hex a #rrggbb en minúsculas', () => {
    expect(normalizarHex('#ABC')).toBe('#aabbcc')
    expect(normalizarHex('1E90FF')).toBe('#1e90ff')
    expect(normalizarHex('#12345')).toBeNull()
    expect(normalizarHex('rojo')).toBeNull()
  })
})

const GRILLA = { dias: [1, 2, 3, 4, 5], inicio: 7 * 60, fin: 14 * 60 }
const franja = (dia_semana: number, hora_inicio: string, hora_fin: string) => ({
  dia_semana,
  hora_inicio,
  hora_fin,
})

describe('posicionBloque', () => {
  it('calcula top y alto en porcentaje de la columna', () => {
    const { top, alto } = posicionBloque(franja(1, '08:00', '09:00'), GRILLA)
    expect(top).toBeCloseTo((60 / 420) * 100)
    expect(alto).toBeCloseTo((60 / 420) * 100)
  })

  it('respeta los minutos que no son múltiplos de 30', () => {
    const { top, alto } = posicionBloque(franja(1, '08:40', '09:20'), GRILLA)
    expect(top).toBeCloseTo((100 / 420) * 100)
    expect(alto).toBeCloseTo((40 / 420) * 100)
  })
})

describe('particionarSolapados', () => {
  it('sin solape, todo en un carril', () => {
    expect(
      particionarSolapados([franja(1, '08:00', '09:00'), franja(1, '10:00', '11:00')]),
    ).toEqual([
      { carril: 0, carriles: 1 },
      { carril: 0, carriles: 1 },
    ])
  })

  it('dos franjas que se pisan quedan lado a lado', () => {
    expect(
      particionarSolapados([franja(1, '08:00', '09:00'), franja(1, '08:30', '09:30')]),
    ).toEqual([
      { carril: 0, carriles: 2 },
      { carril: 1, carriles: 2 },
    ])
  })

  it('tres encadenadas comparten el grupo y reutilizan carriles', () => {
    const resultado = particionarSolapados([
      franja(1, '08:00', '09:00'),
      franja(1, '08:30', '09:30'),
      franja(1, '09:00', '10:00'),
    ])
    expect(resultado.map((r) => r.carriles)).toEqual([2, 2, 2])
    expect(resultado.map((r) => r.carril)).toEqual([0, 1, 0])
  })

  it('las contiguas no se consideran solapadas', () => {
    expect(
      particionarSolapados([franja(1, '08:00', '09:00'), franja(1, '09:00', '10:00')]),
    ).toEqual([
      { carril: 0, carriles: 1 },
      { carril: 0, carriles: 1 },
    ])
  })
})

describe('minutosEnPosicion y desplazamientoEnMinutos', () => {
  it('convierte un punto de la columna a minutos ajustados a 30', () => {
    // Columna de 420 px para 420 minutos: 1 px = 1 minuto.
    expect(minutosEnPosicion(0, 420, GRILLA)).toBe(7 * 60)
    expect(minutosEnPosicion(90, 420, GRILLA)).toBe(8 * 60 + 30)
    expect(minutosEnPosicion(-20, 420, GRILLA)).toBe(7 * 60)
    expect(minutosEnPosicion(999, 420, GRILLA)).toBe(13 * 60 + 30)
  })

  it('redondea el desplazamiento a filas de 30', () => {
    expect(desplazamientoEnMinutos(44, 420, GRILLA)).toBe(30)
    expect(desplazamientoEnMinutos(46, 420, GRILLA)).toBe(60)
    expect(desplazamientoEnMinutos(-14, 420, GRILLA)).toBe(0)
  })
})

describe('moverFranja', () => {
  it('conserva el desfase y la duración', () => {
    expect(moverFranja(franja(1, '08:40', '09:20'), 30, 1, GRILLA)).toEqual(
      franja(1, '09:10', '09:50'),
    )
  })

  it('cambia de día', () => {
    expect(moverFranja(franja(1, '08:00', '09:00'), 0, 3, GRILLA)).toEqual(
      franja(3, '08:00', '09:00'),
    )
  })

  it('se detiene en los bordes de la grilla', () => {
    expect(moverFranja(franja(1, '07:30', '08:30'), -120, 1, GRILLA)).toEqual(
      franja(1, '07:00', '08:00'),
    )
    expect(moverFranja(franja(1, '12:30', '13:30'), 120, 1, GRILLA)).toEqual(
      franja(1, '13:00', '14:00'),
    )
  })
})

describe('estirarFranja', () => {
  it('corre el fin de a 30 minutos', () => {
    expect(estirarFranja(franja(2, '08:00', '09:00'), 60, GRILLA)).toEqual(
      franja(2, '08:00', '10:00'),
    )
  })

  it('dura 30 minutos como mínimo', () => {
    expect(estirarFranja(franja(2, '08:00', '09:00'), -240, GRILLA)).toEqual(
      franja(2, '08:00', '08:30'),
    )
  })

  it('no pasa del fin de la grilla', () => {
    expect(estirarFranja(franja(2, '12:00', '13:00'), 240, GRILLA)).toEqual(
      franja(2, '12:00', '14:00'),
    )
  })
})

describe('reemplazarFranja', () => {
  it('reemplaza solo la franja con ese id y deja las demás en orden', () => {
    const horarios = [
      { id: 'a', ...franja(1, '08:00', '09:00') },
      { id: 'b', ...franja(3, '10:00', '11:00') },
      { id: 'c', ...franja(5, '12:00', '13:00') },
    ]
    const resultado = reemplazarFranja(horarios, 'b', franja(4, '10:30', '11:30'))
    expect(resultado).toEqual([
      horarios[0],
      { id: 'b', ...franja(4, '10:30', '11:30') },
      horarios[2],
    ])
    expect(resultado[0]).toBe(horarios[0])
  })
})

describe('franjaChoca', () => {
  const visibles = [
    { id: 'a', ...franja(1, '09:00', '10:00') },
    { id: 'b', ...franja(2, '09:00', '10:00') },
  ]

  it('detecta el choque con una franja de otra materia', () => {
    expect(franjaChoca(visibles, franja(1, '09:30', '10:30'), 'x')).toBe(true)
  })

  it('las franjas contiguas o de otro día no chocan', () => {
    expect(franjaChoca(visibles, franja(1, '10:00', '11:00'), 'x')).toBe(false)
    expect(franjaChoca(visibles, franja(3, '09:00', '10:00'), 'x')).toBe(false)
  })

  it('ignora la franja propia', () => {
    expect(franjaChoca(visibles, franja(1, '09:30', '10:30'), 'a')).toBe(false)
  })
})

describe('abreviarDocentes', () => {
  it('abrevia el nombre y cuenta los demás docentes', () => {
    expect(abreviarDocentes([])).toBeNull()
    expect(abreviarDocentes(['Pérez, Ana'])).toBe('A. Pérez')
    expect(abreviarDocentes(['Pérez, Ana', 'Gómez, Luis'])).toBe('A. Pérez · L. Gómez')
    expect(abreviarDocentes(['L123'])).toBe('L123')
  })
})

describe('primeraFranjaLibre', () => {
  const franja = (dia_semana: number, hora_inicio: string, hora_fin: string) => ({
    dia_semana,
    hora_inicio,
    hora_fin,
  })

  it('propone el lunes de 08:00 a 09:00 si no hay nada cargado', () => {
    expect(primeraFranjaLibre([])).toEqual(franja(1, '08:00', '09:00'))
  })

  it('salta las horas ocupadas, aunque vengan con segundos', () => {
    const ocupadas = [franja(1, '08:00:00', '09:30:00')]

    expect(primeraFranjaLibre(ocupadas)).toEqual(franja(1, '10:00', '11:00'))
  })

  it('pasa al día siguiente cuando el día está completo', () => {
    expect(primeraFranjaLibre([franja(1, '08:00', '22:00')])).toEqual(franja(2, '08:00', '09:00'))
  })

  it('nunca devuelve una franja que se pise con las ocupadas', () => {
    const ocupadas = [franja(1, '08:00', '10:00'), franja(1, '10:30', '12:00')]
    const libre = primeraFranjaLibre(ocupadas)

    expect(ocupadas.some((otra) => franjasSeSuperponen(libre, otra))).toBe(false)
  })
})
