import { describe, expect, it } from 'vitest'
import {
  catalogoAccion,
  EVENTO_FACTURA,
  nodoAccion,
  nodoCondicion,
  reglaDe,
} from '@/modules/workflows/__tests__/fabricas'
import type { TipoEvento } from '@/modules/workflows/types'
import {
  ANCHO_COLUMNA,
  actualizarNodo,
  borradorDesdeRegla,
  BORRADOR_VACIO,
  cambiarEventoDelBorrador,
  conectar,
  deshacer,
  desconectar,
  duplicarRegla,
  hayErrores,
  insertarCondicionEn,
  reconectar,
  duplicarSubarbol,
  eliminarNodo,
  estadoDeBloque,
  etiquetaDeArista,
  fraseRegla,
  hijosDe,
  iniciarHistorial,
  nuevoNodoAccion,
  nuevoNodoCondicion,
  ordenarArbol,
  payloadDesdeBorrador,
  posicionDisparador,
  profundidad,
  puedeConectar,
  rehacer,
  registrarCambio,
  subarbol,
  textoContadores,
  validarBorrador,
  type BorradorFlujo,
  type NodoEditor,
} from '@/modules/workflows/utils-grafo'

const CATALOGO = [
  catalogoAccion('notificar', { admite_plantilla: true }),
  catalogoAccion('alerta_interna'),
  catalogoAccion('crear_tarea'),
  catalogoAccion('aplicar_penalidad', {
    eventos_permitidos: ['factura.vencida'],
    requiere_aprobacion_por_defecto: true,
  }),
  catalogoAccion('registrar_pago', { eventos_permitidos: ['pago.registrado'] }),
  catalogoAccion('actualizar_cuenta_corriente', { implementada: false }),
]

/** disparador → condición ─Sí→ [notificar, tarea]  /  ─No→ condición2 ─Sí→ alerta */
function reglaConRamas() {
  return reglaDe({
    nodos: [
      nodoCondicion('c-1', { orden: 0 }),
      nodoAccion('a-1', {
        padre_id: 'c-1',
        rama: 'si',
        tipo_accion: 'notificar',
        notificacion_template_id: 'p-1',
        accion_config: { destinatario: 'responsables_habilitados' },
        orden: 0,
      }),
      nodoAccion('a-2', {
        padre_id: 'c-1',
        rama: 'si',
        tipo_accion: 'crear_tarea',
        accion_config: { titulo: 'Llamar' },
        orden: 1,
      }),
      nodoCondicion('c-2', {
        padre_id: 'c-1',
        rama: 'no',
        condicion: {
          logica: 'alguna',
          comparaciones: [
            { campo: 'nombre_familia', operador: 'contiene', valor: 'Pérez' },
            { campo: 'monto_deuda', operador: '>=', valor: 1000 },
          ],
        },
      }),
      nodoAccion('a-3', {
        padre_id: 'c-2',
        rama: 'si',
        tipo_accion: 'alerta_interna',
        requiere_aprobacion_humana: true,
      }),
    ],
  })
}

function borradorConRamas(): BorradorFlujo {
  return borradorDesdeRegla(reglaConRamas())
}

describe('borradorDesdeRegla y payloadDesdeBorrador', () => {
  it('cargar y volver a armar la regla conserva el árbol, la config y la aprobación', () => {
    const payload = payloadDesdeBorrador(borradorConRamas(), CATALOGO, EVENTO_FACTURA)

    expect(payload).toMatchObject({
      nombre: 'Aviso de mora',
      tipo_evento_id: 'e-1',
      activo: true,
    })
    const porId = new Map(payload.nodos.map((nodo) => [nodo.id, nodo]))
    expect(porId.get('c-1')).toMatchObject({
      tipo: 'condicion',
      padre_id: null,
      condicion: {
        logica: 'todas',
        comparaciones: [{ campo: 'dias_vencido', operador: '>', valor: 30 }],
      },
      tipo_accion: null,
    })
    expect(porId.get('a-1')).toMatchObject({
      padre_id: 'c-1',
      rama: 'si',
      tipo_accion: 'notificar',
      notificacion_template_id: 'p-1',
      requiere_aprobacion_humana: false,
    })
    expect(porId.get('a-3')).toMatchObject({ requiere_aprobacion_humana: true })
    expect(porId.get('c-2')?.condicion?.comparaciones[1]).toEqual({
      campo: 'monto_deuda',
      operador: '>=',
      valor: 1000,
    })
  })

  it('manda los números como número y el texto como texto', () => {
    const borrador = borradorConRamas()
    const payload = payloadDesdeBorrador(borrador, CATALOGO, EVENTO_FACTURA)
    const [primera] = payload.nodos.find((n) => n.id === 'c-2')?.condicion?.comparaciones ?? []

    expect(primera.valor).toBe('Pérez')
  })

  it('no manda plantilla si la acción no la admite ni destinatarios si no corresponde', () => {
    const borrador = borradorConRamas()
    const modificado = {
      ...borrador,
      nodos: actualizarNodo(borrador.nodos, 'a-2', {
        plantillaId: 'p-9',
        seleccion: { rolIds: ['r-1'], usuarioIds: [] },
      }),
    }
    const tarea = payloadDesdeBorrador(modificado, CATALOGO, EVENTO_FACTURA).nodos.find(
      (n) => n.id === 'a-2',
    )

    expect(tarea?.notificacion_template_id).toBeNull()
    // `crear_tarea` asigna a los destinatarios: ahí sí viajan.
    expect(tarea?.destinatarios.rol_ids).toEqual(['r-1'])
    const alerta = payloadDesdeBorrador(modificado, CATALOGO, EVENTO_FACTURA).nodos.find(
      (n) => n.id === 'a-1',
    )
    expect(alerta?.destinatarios).toEqual({ rol_ids: [], usuario_ids: [] })
  })

  it('una regla migrada sin posiciones se acomoda sola', () => {
    const regla = reglaDe({ nodos: [nodoAccion('n-1', { posicion: null })] })

    const [nodo] = borradorDesdeRegla(regla).nodos

    expect(nodo.posicion).toEqual({ x: ANCHO_COLUMNA, y: 0 })
  })
})

describe('árbol', () => {
  it('hijosDe separa por salida y subarbol junta todo lo que cuelga', () => {
    const { nodos } = borradorConRamas()

    expect(hijosDe(nodos, 'c-1', 'si').map((n) => n.id)).toEqual(['a-1', 'a-2'])
    expect(hijosDe(nodos, 'c-1', 'no').map((n) => n.id)).toEqual(['c-2'])
    expect(subarbol(nodos, 'c-1')).toHaveLength(5)
    expect(subarbol(nodos, 'c-2').map((n) => n.id)).toEqual(['c-2', 'a-3'])
  })

  it('eliminar un nodo deja sueltos a sus hijos y conserva lo que cuelga de ellos', () => {
    const { nodos } = borradorConRamas()

    const resultado = eliminarNodo(nodos, 'c-2')

    expect(resultado.map((n) => n.id).sort()).toEqual(['a-1', 'a-2', 'a-3', 'c-1'])
    expect(resultado.find((n) => n.id === 'a-3')).toMatchObject({ padreId: null, suelto: true })
  })

  it('profundidad cuenta los nodos desde el disparador', () => {
    const { nodos } = borradorConRamas()

    expect(profundidad(nodos, 'c-1')).toBe(1)
    expect(profundidad(nodos, 'a-3')).toBe(3)
  })
})

describe('conexiones', () => {
  function conSuelto(): NodoEditor[] {
    const { nodos } = borradorConRamas()
    return [...nodos, { ...nuevoNodoAccion(null, null), id: 'suelto', suelto: true }]
  }

  it('un nodo suelto se conecta a una salida de condición', () => {
    const nodos = conSuelto()

    expect(puedeConectar(nodos, { origenId: 'c-2', destinoId: 'suelto', rama: 'no' })).toBe(true)
    const resultado = conectar(nodos, { origenId: 'c-2', destinoId: 'suelto', rama: 'no' })
    expect(resultado.find((n) => n.id === 'suelto')).toMatchObject({
      padreId: 'c-2',
      rama: 'no',
      suelto: false,
    })
  })

  it('un nodo ya conectado no puede tener un segundo padre', () => {
    const { nodos } = borradorConRamas()

    expect(puedeConectar(nodos, { origenId: 'c-2', destinoId: 'a-1', rama: 'si' })).toBe(false)
  })

  it('una acción no tiene salidas y una condición necesita elegir Sí o No', () => {
    const nodos = conSuelto()

    expect(puedeConectar(nodos, { origenId: 'a-1', destinoId: 'suelto', rama: 'si' })).toBe(false)
    expect(puedeConectar(nodos, { origenId: 'c-2', destinoId: 'suelto', rama: null })).toBe(false)
  })

  it('no deja cerrar un ciclo ni conectar un nodo consigo mismo', () => {
    const { nodos } = borradorConRamas()
    const desconectada = desconectar(nodos, 'c-1')

    expect(puedeConectar(desconectada, { origenId: 'c-2', destinoId: 'c-1', rama: 'si' })).toBe(
      false,
    )
    expect(puedeConectar(desconectada, { origenId: 'c-1', destinoId: 'c-1', rama: 'si' })).toBe(
      false,
    )
  })

  it('el disparador conecta sin rama', () => {
    const nodos = conSuelto()

    expect(puedeConectar(nodos, { origenId: null, destinoId: 'suelto', rama: null })).toBe(true)
    expect(puedeConectar(nodos, { origenId: null, destinoId: 'suelto', rama: 'si' })).toBe(false)
  })

  it('no deja pasar de la profundidad máxima', () => {
    let nodos: NodoEditor[] = []
    let padre: string | null = null
    for (let i = 0; i < 6; i += 1) {
      const condicion: NodoEditor = {
        ...nuevoNodoCondicion(padre, padre ? 'si' : null),
        id: `n-${i}`,
      }
      nodos = [...nodos, condicion]
      padre = condicion.id
    }
    nodos = [...nodos, { ...nuevoNodoAccion(null, null), id: 'suelto', suelto: true }]

    expect(puedeConectar(nodos, { origenId: 'n-5', destinoId: 'suelto', rama: 'si' })).toBe(false)
    expect(puedeConectar(nodos, { origenId: 'n-4', destinoId: 'suelto', rama: 'si' })).toBe(true)
  })

  it('desconectar deja el nodo suelto con su subárbol', () => {
    const { nodos } = borradorConRamas()

    const resultado = desconectar(nodos, 'c-2')

    expect(resultado.find((n) => n.id === 'c-2')).toMatchObject({
      padreId: null,
      rama: null,
      suelto: true,
    })
    expect(resultado.find((n) => n.id === 'a-3')?.padreId).toBe('c-2')
  })
})

describe('ordenarArbol', () => {
  it('pone cada nivel en su columna y las hojas en filas distintas', () => {
    const ordenado = ordenarArbol(borradorConRamas().nodos)
    const pos = (id: string) => ordenado.find((n) => n.id === id)?.posicion

    expect(pos('c-1')?.x).toBe(ANCHO_COLUMNA)
    expect(pos('a-1')?.x).toBe(ANCHO_COLUMNA * 2)
    expect(pos('c-2')?.x).toBe(ANCHO_COLUMNA * 2)
    expect(pos('a-3')?.x).toBe(ANCHO_COLUMNA * 3)
    const filas = ['a-1', 'a-2', 'a-3'].map((id) => pos(id)?.y)
    expect(new Set(filas).size).toBe(3)
  })

  it('centra el padre entre sus hijos y el disparador entre los primeros nodos', () => {
    const ordenado = ordenarArbol(borradorConRamas().nodos)
    const y = (id: string) => ordenado.find((n) => n.id === id)?.posicion.y ?? 0

    expect(y('c-2')).toBe(y('a-3'))
    expect(y('c-1')).toBe(
      (Math.min(y('a-1'), y('a-2'), y('c-2')) + Math.max(y('a-1'), y('a-2'), y('c-2'))) / 2,
    )
    expect(posicionDisparador(ordenado)).toEqual({ x: 0, y: y('c-1') })
  })
})

describe('ordenarArbol con nodos agrandados', () => {
  it('deja más lugar a un nodo alto para que no pise al siguiente', () => {
    const { nodos } = borradorConRamas()

    const normal = ordenarArbol(nodos)
    const conAltura = ordenarArbol(nodos, new Map([['a-1', 400]]))
    const y = (lista: NodoEditor[], id: string) => lista.find((n) => n.id === id)?.posicion.y ?? 0

    expect(y(normal, 'a-2') - y(normal, 'a-1')).toBe(128)
    expect(y(conAltura, 'a-2') - y(conAltura, 'a-1')).toBe(432)
  })
})

describe('bloques sin conectar', () => {
  function conSuelto(): BorradorFlujo {
    const base = borradorConRamas()
    return {
      ...base,
      nodos: [
        ...base.nodos,
        { ...nuevoNodoCondicion(null, null), id: 'suelta', suelto: true },
        { ...nuevoNodoAccion('suelta', 'si', CATALOGO[1]), id: 'hija' },
      ],
    }
  }

  it('el payload separa los sueltos (con su subárbol) de los nodos que corren', () => {
    const payload = payloadDesdeBorrador(conSuelto(), CATALOGO, EVENTO_FACTURA)

    expect(payload.nodos.map((n) => n.id)).not.toContain('suelta')
    expect(payload.nodos.map((n) => n.id)).not.toContain('hija')
    expect(payload.bloques_sueltos).toHaveLength(2)
  })

  it('guardar y volver a cargar conserva los sueltos y no los conecta', () => {
    const payload = payloadDesdeBorrador(conSuelto(), CATALOGO, EVENTO_FACTURA)
    const regla = reglaDe({
      nodos: [],
      bloques_sueltos: payload.bloques_sueltos,
    })

    const recargado = borradorDesdeRegla(regla)

    expect(recargado.nodos.map((n) => n.id)).toEqual(['suelta', 'hija'])
    expect(recargado.nodos.find((n) => n.id === 'suelta')?.suelto).toBe(true)
  })

  it('duplicar la regla conserva los sueltos con ids nuevos', () => {
    const payload = payloadDesdeBorrador(conSuelto(), CATALOGO, EVENTO_FACTURA)
    const copia = duplicarRegla(reglaDe({ nodos: [], bloques_sueltos: payload.bloques_sueltos }))

    expect(copia.nodos).toHaveLength(2)
    expect(copia.nodos.map((n) => n.id)).not.toContain('suelta')
    const raiz = copia.nodos.find((n) => n.suelto)
    expect(copia.nodos.find((n) => n.padreId === raiz?.id)).toBeDefined()
  })
})

describe('validarBorrador', () => {
  it('un borrador sin nombre, sin evento y sin acciones lista cada problema', () => {
    const errores = validarBorrador(BORRADOR_VACIO, CATALOGO)

    expect(errores.general).toEqual([
      'Falta el nombre de la regla.',
      'Elegí qué evento dispara la regla.',
      'La regla necesita al menos una acción.',
    ])
  })

  it('marca los nodos incompletos con su primer problema', () => {
    const borrador: BorradorFlujo = {
      ...borradorConRamas(),
      nodos: [
        { ...nuevoNodoCondicion(null, null), id: 'c' },
        { ...nuevoNodoAccion(null, null), id: 'sin-tipo', padreId: 'c', rama: 'si' },
        {
          ...nuevoNodoAccion(null, null, CATALOGO[0]),
          id: 'sin-plantilla',
          padreId: 'c',
          rama: 'no',
        },
        {
          ...nuevoNodoAccion(null, null, CATALOGO[2]),
          id: 'sin-titulo',
          padreId: 'c',
          rama: 'no',
        },
        { ...nuevoNodoAccion(null, null, CATALOGO[5]), id: 'no-impl', padreId: 'c', rama: 'no' },
        { ...nuevoNodoAccion(null, null, CATALOGO[1]), id: 'suelto', suelto: true },
      ],
    }

    const { porNodo } = validarBorrador(borrador, CATALOGO)

    expect(porNodo.c).toBe('Completá el campo, el operador y el valor')
    expect(porNodo['sin-tipo']).toBe('Elegí qué hace esta acción')
    expect(porNodo['sin-plantilla']).toBe('Falta la plantilla')
    expect(porNodo['sin-titulo']).toBe('Falta el título de la tarea')
    expect(porNodo['no-impl']).toBe('Esta acción todavía no está disponible')
    expect(porNodo.suelto).toBeUndefined()
  })

  it('un bloque sin conectar no bloquea: solo lleva un aviso, igual que su subárbol', () => {
    const borrador: BorradorFlujo = {
      ...borradorConRamas(),
      nodos: [
        ...borradorConRamas().nodos,
        { ...nuevoNodoCondicion(null, null), id: 'suelta', suelto: true },
        { ...nuevoNodoAccion('suelta', 'si'), id: 'hija' },
      ],
    }

    const errores = validarBorrador(borrador, CATALOGO)

    expect(hayErrores(errores)).toBe(false)
    expect(Object.keys(errores.avisos).sort()).toEqual(['hija', 'suelta'])
  })

  it('un valor numérico inválido o fuera de la lista de opciones es un error', () => {
    const campos = [
      ...EVENTO_FACTURA.campos,
      {
        id: 'c-9',
        nombre_interno: 'tipo',
        etiqueta: 'Tipo',
        tipo_dato: 'texto' as const,
        opciones: [{ valor: 'tardanza', etiqueta: 'Tardanza' }],
        busqueda: false,
        permite_otro: false,
      },
    ]
    const condicion = (campo: string, operador: '>' | '==', valor: string): NodoEditor => ({
      ...nuevoNodoCondicion(null, null),
      id: 'c',
      comparaciones: [{ campo, operador, valor }],
    })
    const con = (nodo: NodoEditor): BorradorFlujo => ({
      ...borradorConRamas(),
      nodos: [nodo, { ...nuevoNodoAccion('c', 'si', CATALOGO[1]), id: 'a' }],
    })

    expect(
      validarBorrador(con(condicion('dias_vencido', '>', 'abc')), CATALOGO, campos).porNodo.c,
    ).toBe('El valor tiene que ser un número')
    expect(validarBorrador(con(condicion('tipo', '==', 'otro')), CATALOGO, campos).porNodo.c).toBe(
      'Elegí uno de los valores de la lista',
    )
    expect(
      validarBorrador(con(condicion('tipo', '==', 'tardanza')), CATALOGO, campos).porNodo.c,
    ).toBeUndefined()
  })

  it('un borrador completo no tiene errores', () => {
    const errores = validarBorrador(borradorConRamas(), CATALOGO)

    expect(errores).toEqual({ general: [], porNodo: {}, avisos: {} })
  })

  it('avisa si se pasa de la profundidad máxima', () => {
    let nodos: NodoEditor[] = []
    let padre: string | null = null
    for (let i = 0; i < 7; i += 1) {
      const nodo: NodoEditor = {
        ...nuevoNodoAccion(padre, padre ? 'si' : null, CATALOGO[1]),
        id: `n-${i}`,
        tipo: i < 6 ? 'condicion' : 'accion',
        comparaciones: i < 6 ? [{ campo: 'dias_vencido', operador: '>', valor: '1' }] : [],
      }
      nodos = [...nodos, nodo]
      padre = nodo.id
    }

    const { general } = validarBorrador({ ...borradorConRamas(), nodos }, CATALOGO)

    expect(general).toContain('El flujo admite hasta 6 niveles.')
  })
})

describe('cambiarEventoDelBorrador', () => {
  const otro: TipoEvento = { ...EVENTO_FACTURA, id: 'e-2', nombre: 'pago.registrado', campos: [] }

  it('limpia las comparaciones y las acciones que el evento nuevo no admite', () => {
    const borrador: BorradorFlujo = {
      ...borradorConRamas(),
      nodos: [
        ...borradorConRamas().nodos,
        { ...nuevoNodoAccion('c-1', 'no', CATALOGO[3]), id: 'penalidad' },
      ],
    }

    const resultado = cambiarEventoDelBorrador(borrador, otro.id, CATALOGO, otro.nombre)
    const por = (id: string) => resultado.nodos.find((n) => n.id === id)

    expect(resultado.tipoEventoId).toBe('e-2')
    expect(por('c-1')?.comparaciones).toEqual([{ campo: '', operador: '', valor: '' }])
    expect(por('penalidad')?.tipoAccion).toBe('')
    expect(por('a-3')?.tipoAccion).toBe('alerta_interna')
  })

  it('elegir el mismo evento no toca nada', () => {
    const borrador = borradorConRamas()

    expect(cambiarEventoDelBorrador(borrador, 'e-1', CATALOGO, 'factura.vencida')).toBe(borrador)
  })
})

describe('duplicar', () => {
  it('duplicar un subárbol deja ids nuevos y la copia cuelga del mismo padre', () => {
    const { nodos } = borradorConRamas()

    const { nodos: resultado, copiaId } = duplicarSubarbol(nodos, 'c-2')

    expect(resultado).toHaveLength(nodos.length + 2)
    const copia = resultado.find((n) => n.id === copiaId)
    expect(copia).toMatchObject({ tipo: 'condicion', padreId: 'c-1', rama: 'no' })
    const hijos = resultado.filter((n) => n.padreId === copiaId)
    expect(hijos).toHaveLength(1)
    const ids = resultado.map((n) => n.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('no duplica si la copia pasa del tope de nodos', () => {
    const { nodos } = borradorConRamas()
    const lleno = Array.from({ length: 28 }, (_, i) => ({
      ...nuevoNodoAccion(null, null),
      id: `x-${i}`,
    }))
    const todos = [...nodos, ...lleno.slice(0, 25)]

    const resultado = duplicarSubarbol(todos, 'c-1')

    expect(resultado.copiaId).toBeNull()
    expect(resultado.nodos).toHaveLength(todos.length)
  })

  it('duplicar la regla genera ids nuevos, queda inactiva y mantiene la estructura', () => {
    const regla = reglaConRamas()

    const copia = duplicarRegla(regla)

    expect(copia.nombre).toBe('Copia de Aviso de mora')
    expect(copia.activo).toBe(false)
    const originales = new Set(regla.nodos.map((n) => n.id))
    expect(copia.nodos.every((n) => !originales.has(n.id))).toBe(true)
    const raiz = copia.nodos.find((n) => n.padreId === null)
    expect(hijosDe(copia.nodos, raiz?.id ?? '', 'si')).toHaveLength(2)
    expect(
      copia.nodos.find((n) => n.tipoAccion === 'alerta_interna')?.requiereAprobacionHumana,
    ).toBe(true)
  })
})

describe('fraseRegla', () => {
  it('cuenta la regla con sus ramas y acciones hermanas', () => {
    const frase = fraseRegla(borradorConRamas(), [EVENTO_FACTURA])

    expect(frase).toBe(
      'Cuando vence una factura: si días vencido es mayor que 30, entonces notificar y crear tarea. Si no se cumple días vencido es mayor que 30, pero si familia contiene Pérez o monto de la deuda es mayor o igual que 1000, entonces alerta interna (con aprobación).',
    )
  })

  it('una acción colgada del disparador se dice "siempre"', () => {
    const borrador = {
      ...BORRADOR_VACIO,
      tipoEventoId: 'e-1',
      nodos: [nuevoNodoAccion(null, null, CATALOGO[1])],
    }

    expect(fraseRegla(borrador, [EVENTO_FACTURA])).toBe(
      'Cuando vence una factura: siempre alerta interna.',
    )
  })

  it('las acciones directas y las condiciones conviven en la frase', () => {
    const condicion = {
      ...nuevoNodoCondicion(null, null),
      comparaciones: [{ campo: 'dias_vencido', operador: '>' as const, valor: '30' }],
    }
    const borrador = {
      ...BORRADOR_VACIO,
      tipoEventoId: 'e-1',
      nodos: [
        nuevoNodoAccion(null, null, CATALOGO[1]),
        condicion,
        nuevoNodoAccion(condicion.id, 'si', CATALOGO[2]),
      ],
    }

    expect(fraseRegla(borrador, [EVENTO_FACTURA])).toBe(
      'Cuando vence una factura: siempre alerta interna. Si días vencido es mayor que 30, entonces crear tarea.',
    )
  })

  it('una condición dentro de la salida Sí se dice "y además, si" y la No, "si no se cumple"', () => {
    const a = {
      ...nuevoNodoCondicion(null, null),
      comparaciones: [{ campo: 'dias_vencido', operador: '>' as const, valor: '30' }],
    }
    const b = {
      ...nuevoNodoCondicion(a.id, 'si'),
      comparaciones: [{ campo: 'monto_deuda', operador: '>' as const, valor: '500' }],
    }
    const borrador = {
      ...BORRADOR_VACIO,
      tipoEventoId: 'e-1',
      nodos: [
        a,
        nuevoNodoAccion(a.id, 'si', CATALOGO[1]),
        b,
        nuevoNodoAccion(b.id, 'si', CATALOGO[2]),
        nuevoNodoAccion(a.id, 'no', CATALOGO[0]),
      ],
    }

    expect(fraseRegla(borrador, [EVENTO_FACTURA])).toBe(
      'Cuando vence una factura: si días vencido es mayor que 30, entonces alerta interna; y además, si monto de la deuda es mayor que 500, entonces crear tarea. Si no se cumple días vencido es mayor que 30, notificar.',
    )
  })

  it('sin evento pide elegirlo y sin acciones lo dice', () => {
    expect(fraseRegla(BORRADOR_VACIO, [EVENTO_FACTURA])).toBe(
      'Elegí el evento que dispara la regla.',
    )
    expect(fraseRegla({ ...BORRADOR_VACIO, tipoEventoId: 'e-1' }, [EVENTO_FACTURA])).toBe(
      'Cuando vence una factura, todavía sin acciones.',
    )
  })

  it('ignora los bloques sueltos', () => {
    const borrador = {
      ...BORRADOR_VACIO,
      tipoEventoId: 'e-1',
      nodos: [{ ...nuevoNodoAccion(null, null, CATALOGO[1]), suelto: true }],
    }

    expect(fraseRegla(borrador, [EVENTO_FACTURA])).toBe(
      'Cuando vence una factura, todavía sin acciones.',
    )
  })
})

describe('historial', () => {
  it('deshacer y rehacer recorren los cambios', () => {
    let h = iniciarHistorial('a')
    h = registrarCambio(h, 'b')
    h = registrarCambio(h, 'c')

    h = deshacer(h)
    expect(h.presente).toBe('b')
    h = deshacer(h)
    expect(h.presente).toBe('a')
    expect(deshacer(h)).toBe(h)
    h = rehacer(h)
    expect(h.presente).toBe('b')
  })

  it('un cambio nuevo descarta lo que se podía rehacer', () => {
    let h = registrarCambio(iniciarHistorial('a'), 'b')
    h = deshacer(h)

    h = registrarCambio(h, 'c')

    expect(h.futuro).toEqual([])
    expect(rehacer(h)).toBe(h)
  })

  it('un cambio idéntico no suma un paso', () => {
    const h = iniciarHistorial({ x: 1 })

    expect(registrarCambio(h, h.presente)).toBe(h)
  })

  it('recuerda un máximo de pasos', () => {
    let h = iniciarHistorial(0)
    for (let i = 1; i <= 80; i += 1) h = registrarCambio(h, i)

    expect(h.pasado).toHaveLength(50)
  })
})

describe('paleta', () => {
  const evento = 'factura.vencida'

  it('distingue disponible, no permitida para el evento y todavía no disponible', () => {
    expect(estadoDeBloque('notificar', CATALOGO, evento).estado).toBe('disponible')
    expect(estadoDeBloque('registrar_pago', CATALOGO, evento)).toMatchObject({
      estado: 'no_permitida',
    })
    expect(estadoDeBloque('actualizar_cuenta_corriente', CATALOGO, evento)).toEqual({
      estado: 'no_disponible',
      motivo: 'Todavía no disponible',
    })
  })

  it('sin evento elegido no bloquea por evento', () => {
    expect(estadoDeBloque('registrar_pago', CATALOGO, null).estado).toBe('disponible')
  })
})

describe('textoContadores', () => {
  it('lista lo que tiene valor, en singular o plural', () => {
    expect(
      textoContadores({
        workflow_nodo_id: 'n-1',
        exitoso: 12,
        fallido: 1,
        pendiente: 0,
        rechazado: 0,
      }),
    ).toBe('12 exitosas · 1 fallida')
    expect(
      textoContadores({
        workflow_nodo_id: 'n-1',
        exitoso: 0,
        fallido: 0,
        pendiente: 0,
        rechazado: 0,
      }),
    ).toBe('Sin ejecuciones')
  })
})

describe('insertarCondicionEn', () => {
  it('mete la condición entre el padre y el hijo, que pasa a la salida Sí', () => {
    const { nodos, condicionId } = insertarCondicionEn(borradorConRamas().nodos, 'a-3')

    const nueva = nodos.find((n) => n.id === condicionId)
    expect(nueva).toMatchObject({ tipo: 'condicion', padreId: 'c-2', rama: 'si', suelto: false })
    expect(nodos.find((n) => n.id === 'a-3')).toMatchObject({ padreId: condicionId, rama: 'si' })
  })

  it('un hijo del disparador queda colgado de la condición nueva', () => {
    const { nodos, condicionId } = insertarCondicionEn(borradorConRamas().nodos, 'c-1')

    expect(nodos.find((n) => n.id === condicionId)).toMatchObject({ padreId: null, rama: null })
    expect(nodos.find((n) => n.id === 'c-1')).toMatchObject({ padreId: condicionId, rama: 'si' })
  })

  it('no inserta si el subárbol pasaría de la profundidad máxima', () => {
    let nodos: NodoEditor[] = []
    let padre: string | null = null
    for (let i = 0; i < 6; i += 1) {
      const nodo: NodoEditor = {
        ...nuevoNodoCondicion(padre, padre ? 'si' : null),
        id: `n-${i}`,
      }
      nodos = [...nodos, nodo]
      padre = nodo.id
    }

    const resultado = insertarCondicionEn(nodos, 'n-5')

    expect(resultado.condicionId).toBeNull()
    expect(resultado.nodos).toHaveLength(6)
  })
})

describe('reconectar', () => {
  it('mueve la conexión a otro destino suelto y deja suelto al anterior', () => {
    const base = borradorConRamas().nodos
    const nodos = [
      ...base,
      { ...nuevoNodoAccion(null, null, CATALOGO[1]), id: 'libre', suelto: true },
    ]

    const resultado = reconectar(nodos, 'a-3', { origenId: 'c-1', destinoId: 'libre', rama: 'si' })

    expect(resultado.find((n) => n.id === 'libre')).toMatchObject({
      padreId: 'c-1',
      rama: 'si',
      suelto: false,
    })
    expect(resultado.find((n) => n.id === 'a-3')).toMatchObject({ padreId: null, suelto: true })
  })

  it('cambiar solo la rama del mismo destino es válido', () => {
    const resultado = reconectar(borradorConRamas().nodos, 'a-3', {
      origenId: 'c-2',
      destinoId: 'a-3',
      rama: 'no',
    })

    expect(resultado.find((n) => n.id === 'a-3')).toMatchObject({ padreId: 'c-2', rama: 'no' })
  })

  it('si el destino nuevo ya está conectado, no cambia nada', () => {
    const nodos = borradorConRamas().nodos

    const resultado = reconectar(nodos, 'a-3', { origenId: 'c-1', destinoId: 'a-1', rama: 'no' })

    expect(resultado).toEqual(nodos)
  })
})

describe('etiquetaDeArista', () => {
  const accion = { tipo: 'accion' as const }
  const condicion = { tipo: 'condicion' as const }

  it('se lee según de dónde sale y a qué llega', () => {
    expect(etiquetaDeArista(null, null, accion)).toBe('Siempre')
    expect(etiquetaDeArista(null, null, condicion)).toBe('Solo si')
    expect(etiquetaDeArista(condicion, 'si', accion)).toBe('Entonces')
    expect(etiquetaDeArista(condicion, 'si', condicion)).toBe('Y además, si')
    expect(etiquetaDeArista(condicion, 'no', accion)).toBe('Si no')
    expect(etiquetaDeArista(condicion, 'no', condicion)).toBe('Si no, pero si')
  })
})
