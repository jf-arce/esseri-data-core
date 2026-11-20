import type { NodoWorkflow, RamaNodo } from '@/modules/workflows/types'
import { ETIQUETA_ACCION } from '@/modules/workflows/utils'

// Ancho aproximado por letra a 9.5px semibold: la pastilla crece para mostrar el nombre completo.
const ANCHO_LETRA = 5.5
// Tope de escala: un flujo chico no se agranda más que esto dentro del recuadro.
const ESCALA = 1.3
// Más niveles que esto (disparador incluido) también pasa a la versión compacta.
const MAX_NIVELES_NORMAL = 3

interface Medidas {
  maxFilas: number
  altoAccion: number
  separacion: number
  icono: number
  separacionColumnas: number
  compacta: boolean
}

const NORMAL: Medidas = {
  maxFilas: 5,
  altoAccion: 22,
  separacion: 6,
  icono: 24,
  separacionColumnas: 26,
  compacta: false,
}

// Versión para flujos grandes: acciones como chips sin texto y íconos más chicos. Conserva la
// forma del grafo; el detalle está en la lista "Qué hace la regla" de la tarjeta.
const COMPACTA: Medidas = {
  maxFilas: 8,
  altoAccion: 12,
  separacion: 4,
  icono: 16,
  separacionColumnas: 22,
  compacta: true,
}

const ANCHO_CHIP = 26

function etiqueta(nodo: NodoWorkflow): string {
  return nodo.tipo_accion ? ETIQUETA_ACCION[nodo.tipo_accion] : 'Acción'
}

let lienzo: CanvasRenderingContext2D | null | undefined

/** Ancho real del texto de la pastilla (misma fuente y tamaño que el SVG). Sin canvas, por
 * ejemplo en los tests, cae a una estimación por letra. */
function anchoTexto(texto: string): number {
  if (lienzo === undefined) {
    lienzo =
      typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
  }
  if (!lienzo) return texto.length * ANCHO_LETRA
  lienzo.font = "600 9.5px 'Geist Variable', sans-serif"
  return lienzo.measureText(texto).width
}

function rellenoPastilla(nodo: NodoWorkflow): number {
  return nodo.requiere_aprobacion_humana ? 27 : 18
}

interface NodoPosicionado {
  nodo: NodoWorkflow | null
  nivel: number
  fila: number
  hijos: NodoPosicionado[]
  rama: RamaNodo | null
}

const ORDEN_RAMA: Record<RamaNodo, number> = { si: 0, no: 1 }

function hijosDe(nodos: NodoWorkflow[], padreId: string | null): NodoWorkflow[] {
  return nodos
    .filter((nodo) => nodo.padre_id === padreId)
    .sort(
      (a, b) =>
        (a.rama ? ORDEN_RAMA[a.rama] : 2) - (b.rama ? ORDEN_RAMA[b.rama] : 2) || a.orden - b.orden,
    )
}

/** Acomoda el árbol real (`padre_id` + `rama`): una columna por nivel, una fila por hoja y cada
 * padre centrado entre sus hijos. Corta al llegar a `maxFilas` hojas y cuenta lo que quedó fuera. */
function acomodar(nodos: NodoWorkflow[], maxFilas: number) {
  let filas = 0
  let ocultos = 0

  function ubicar(
    nodo: NodoWorkflow | null,
    nivel: number,
    rama: RamaNodo | null,
  ): NodoPosicionado {
    const hijos: NodoPosicionado[] = []
    for (const hijo of hijosDe(nodos, nodo?.id ?? null)) {
      if (filas >= maxFilas) {
        ocultos += 1
        continue
      }
      hijos.push(ubicar(hijo, nivel + 1, hijo.rama))
    }
    if (hijos.length === 0) return { nodo, nivel, fila: filas++, hijos, rama }
    const fila = (hijos[0].fila + hijos[hijos.length - 1].fila) / 2
    return { nodo, nivel, fila, hijos, rama }
  }

  const raiz = ubicar(null, 0, null)
  return { raiz, filas: Math.max(1, filas), ocultos }
}

function aplanar(posicionado: NodoPosicionado): NodoPosicionado[] {
  return [posicionado, ...posicionado.hijos.flatMap(aplanar)]
}

function elegirLayout(nodos: NodoWorkflow[]) {
  const normal = acomodar(nodos, NORMAL.maxFilas)
  const niveles = Math.max(...aplanar(normal.raiz).map((item) => item.nivel)) + 1
  if (normal.ocultos === 0 && niveles <= MAX_NIVELES_NORMAL) return { ...normal, medidas: NORMAL }
  return { ...acomodar(nodos, COMPACTA.maxFilas), medidas: COMPACTA }
}

/** Resumen del flujo en SVG (no React Flow): disparador (círculo con rayo), condiciones (rombo) y
 * acciones (pastillas, con candado si piden aprobación), dibujados según el árbol real: lo que
 * cuelga directo del evento sale del disparador y las ramas de una condición se rotulan "sí" / "no".
 * Va dentro de un recuadro de alto fijo: el dibujo se escala para entrar y, si el flujo es grande,
 * pasa a una versión compacta, así todas las tarjetas miden igual. Si la regla está activa, un
 * pulso recorre las aristas; inactiva va en gris y quieta. Es liviano a propósito, para que una
 * grilla de tarjetas no cargue un lienzo por regla. */
export function MiniFlujo({ nodos, activo = true }: { nodos: NodoWorkflow[]; activo?: boolean }) {
  const { raiz, filas, ocultos, medidas } = elegirLayout(nodos)
  const { altoAccion, separacion, icono, separacionColumnas, compacta } = medidas
  const mitad = icono / 2
  const todos = aplanar(raiz)
  const alto = Math.max(icono, filas * altoAccion + (filas - 1) * separacion)
  const yCentro = (fila: number) => fila * (altoAccion + separacion) + altoAccion / 2
  const ancho = (item: NodoPosicionado) => {
    if (item.nodo?.tipo !== 'accion') return icono
    return compacta
      ? ANCHO_CHIP
      : Math.ceil(anchoTexto(etiqueta(item.nodo)) + rellenoPastilla(item.nodo))
  }

  const niveles = Math.max(...todos.map((item) => item.nivel)) + 1
  const anchoNivel = Array.from({ length: niveles }, (_, nivel) =>
    Math.max(...todos.filter((item) => item.nivel === nivel).map(ancho)),
  )
  const xNivel = anchoNivel.map((_, nivel) =>
    anchoNivel.slice(0, nivel).reduce((suma, a) => suma + a + separacionColumnas, 0),
  )
  const anchoTotal = xNivel[niveles - 1] + anchoNivel[niveles - 1] + (ocultos > 0 ? 22 : 4)

  const colorDisparador = activo ? 'var(--mod-workflows)' : 'var(--texto-3)'
  const colorCondicion = activo ? 'var(--advertencia)' : 'var(--texto-3)'
  const colorArista = activo ? 'var(--mod-workflows)' : 'var(--borde-fuerte, var(--texto-3))'
  const claseViaje = activo ? 'mini-flujo-viaje' : undefined

  const condiciones = nodos.filter((nodo) => nodo.tipo === 'condicion')
  const acciones = nodos.filter((nodo) => nodo.tipo === 'accion')
  const descripcion = [
    'Evento',
    condiciones.length > 0
      ? `${condiciones.length} ${condiciones.length === 1 ? 'condición' : 'condiciones'}`
      : null,
    ...acciones.map((nodo) => etiqueta(nodo)),
  ]
    .filter(Boolean)
    .join(', ')

  // Trazos ortogonales: del borde derecho del padre a un tramo vertical a mitad de camino y de ahí
  // recto al hijo.
  const aristas: string[] = []
  const rotulos: { x: number; y: number; texto: string }[] = []
  for (const padre of todos) {
    const xSalida = xNivel[padre.nivel] + ancho(padre)
    const ySalida = yCentro(padre.fila)
    for (const hijo of padre.hijos) {
      const xEntrada = xNivel[hijo.nivel]
      const yEntrada = yCentro(hijo.fila)
      const xMedio = xSalida + (xEntrada - xSalida) / 2
      aristas.push(`M ${xSalida} ${ySalida} H ${xMedio} V ${yEntrada} H ${xEntrada}`)
      if (hijo.rama) {
        rotulos.push({ x: xMedio + 2, y: yEntrada - 3, texto: hijo.rama === 'si' ? 'sí' : 'no' })
      }
    }
  }

  const centroDisparador = yCentro(raiz.fila)
  const escalaRayo = icono / 24

  return (
    <div className="flex h-28 items-center">
      <svg
        role="img"
        aria-label={`Flujo: ${descripcion}`}
        viewBox={`0 0 ${anchoTotal} ${alto}`}
        preserveAspectRatio="xMinYMid meet"
        width={anchoTotal * ESCALA}
        height={alto * ESCALA}
        className={`max-h-full max-w-full ${activo ? '' : 'opacity-70'}`}
      >
        <title>{descripcion}</title>
        <g fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          {aristas.map((trazo, indice) => (
            // El orden es fijo: no hay identidad que conservar entre renders.
            <path key={indice} d={trazo} stroke={colorArista} opacity={activo ? 0.45 : 1} />
          ))}
          {activo &&
            aristas.map((trazo, indice) => (
              <path
                key={`viaje-${indice}`}
                d={trazo}
                stroke={colorArista}
                strokeWidth="2.5"
                className={claseViaje}
              />
            ))}
        </g>
        {rotulos.map((rotulo, indice) => (
          <text
            key={indice}
            x={rotulo.x}
            y={rotulo.y}
            fontSize="8"
            fontWeight="700"
            fill="var(--texto-2)"
          >
            {rotulo.texto}
          </text>
        ))}
        <circle cx={mitad} cy={centroDisparador} r={mitad - 2} fill={colorDisparador} />
        <path
          transform={`translate(${mitad} ${centroDisparador}) scale(${escalaRayo})`}
          d="M 1.5 -6 L -3.5 1 L 0 1 L -1.5 6 L 3.5 -1 L 0 -1 Z"
          fill="white"
        />
        {todos.map((item) => {
          const { nodo } = item
          if (!nodo) return null
          const x = xNivel[item.nivel]
          const centro = yCentro(item.fila)
          if (nodo.tipo === 'condicion') {
            const cx = x + mitad
            return (
              <g key={nodo.id}>
                <polygon
                  points={`${cx},${centro - mitad} ${cx + mitad},${centro} ${cx},${centro + mitad} ${cx - mitad},${centro}`}
                  fill={colorCondicion}
                />
                {!compacta && (
                  <text
                    x={cx}
                    y={centro + 3.5}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="700"
                    fill="white"
                  >
                    {nodo.condicion?.comparaciones.length ?? 0}
                  </text>
                )}
              </g>
            )
          }
          const aprobacion = nodo.requiere_aprobacion_humana
          const color = !activo
            ? 'var(--texto-3)'
            : aprobacion
              ? 'var(--advertencia)'
              : 'var(--exito)'
          const y = centro - altoAccion / 2
          if (compacta) {
            return (
              <g key={nodo.id}>
                <title>{etiqueta(nodo)}</title>
                <rect
                  x={x}
                  y={y}
                  width={ANCHO_CHIP}
                  height={altoAccion}
                  rx={altoAccion / 2}
                  fill={color}
                />
                {aprobacion && <circle cx={x + ANCHO_CHIP / 2} cy={centro} r="2" fill="white" />}
              </g>
            )
          }
          return (
            <g key={nodo.id}>
              <rect x={x} y={y} width={ancho(item)} height={altoAccion} rx="11" fill={color} />
              {aprobacion && (
                <g fill="white">
                  <rect x={x + 7} y={y + 10} width="7" height="6" rx="1" />
                  <path
                    d={`M ${x + 8.5} ${y + 10} v -2 a 2 2 0 0 1 4 0 v 2`}
                    fill="none"
                    stroke="white"
                    strokeWidth="1.2"
                  />
                </g>
              )}
              <text
                x={x + (aprobacion ? 18 : 9)}
                y={y + 14.5}
                fontSize="9.5"
                fontWeight="600"
                fill="white"
              >
                {etiqueta(nodo)}
              </text>
            </g>
          )
        })}
        {ocultos > 0 && (
          <text
            x={anchoTotal - 18}
            y={alto - 2}
            fontSize="11"
            fontWeight="700"
            fill="var(--texto-2)"
          >
            +{ocultos}
          </text>
        )}
      </svg>
    </div>
  )
}
