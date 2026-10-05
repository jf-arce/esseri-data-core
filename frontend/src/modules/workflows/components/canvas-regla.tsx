import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import {
  AlertCircleIcon,
  ArrowLeftRightIcon,
  MessageSquareIcon,
  RotateCcwIcon,
  ZapIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type NodoRegla = 'disparador' | 'condicion' | 'accion'

export interface ResumenNodo {
  titulo: string
  detalle: string
  /** Falta configurar algo: el nodo lo marca porque sus campos ya no están a la vista. */
  incompleto?: boolean
}

interface CanvasReglaProps {
  /** Nodo cuyo diálogo está abierto. */
  seleccionado: NodoRegla | null
  onSeleccionar: (nodo: NodoRegla) => void
  disparador: ResumenNodo
  condicion: ResumenNodo
  accion: ResumenNodo
}

interface Posicion {
  x: number
  y: number
}

const ORDEN_NODOS: NodoRegla[] = ['disparador', 'condicion', 'accion']
const ENLACES: readonly (readonly [NodoRegla, NodoRegla])[] = [
  ['disparador', 'condicion'],
  ['condicion', 'accion'],
]

const ANCHO_NODO = 210
const ALTO_NODO = 100
const SEPARACION = 56
const ESCALON = 84
// Alto mínimo del canvas en horizontal; si hay lugar, ocupa el resto de la ventana.
const ALTO_HORIZONTAL = 320
// Ancho que se asume cuando todavía no se pudo medir el canvas.
const ANCHO_POR_DEFECTO = 800
// Por debajo de este ancho los nodos no entran en fila: se apilan en vertical.
const ANCHO_MIN_HORIZONTAL = 760
const SEPARACION_VERTICAL = 44
const MARGEN_VERTICAL = 20
const ALTO_VERTICAL = 2 * MARGEN_VERTICAL + 3 * ALTO_NODO + 2 * SEPARACION_VERTICAL
const PASO_TECLADO = 12
// Movimiento mínimo para que un gesto cuente como arrastre y no como clic.
const UMBRAL_ARRASTRE = 4

interface EstiloNodo {
  etiqueta: string
  icono: ReactNode
  superficie: string
  acento: string
  contorno: string
  trazo: string
}

// Superficies tonales del mockup "Editor de regla" (DESIGN.md §9.10): disparador en violeta de
// workflows, condición en advertencia y acción en el teal de inscripciones/IA.
const NODOS: Record<NodoRegla, EstiloNodo> = {
  disparador: {
    etiqueta: 'Disparador',
    icono: <ZapIcon />,
    superficie: 'bg-sup-workflows',
    acento: 'text-mod-workflows',
    contorno: 'outline-mod-workflows',
    trazo: 'stroke-mod-workflows',
  },
  condicion: {
    etiqueta: 'Condición',
    icono: <ArrowLeftRightIcon />,
    superficie: 'bg-advertencia-suave',
    acento: 'text-advertencia',
    contorno: 'outline-advertencia',
    trazo: 'stroke-advertencia',
  },
  accion: {
    etiqueta: 'Acción',
    icono: <MessageSquareIcon />,
    superficie: 'bg-sup-inscripciones',
    acento: 'text-mod-inscripciones',
    contorno: 'outline-mod-inscripciones',
    trazo: 'stroke-mod-inscripciones',
  },
}

interface Medidas {
  ancho: number
  alto: number
  vertical: boolean
}

function medidasDe(ancho: number, altoMedido: number): Medidas {
  const vertical = ancho < ANCHO_MIN_HORIZONTAL
  return { ancho, alto: vertical ? ALTO_VERTICAL : Math.max(ALTO_HORIZONTAL, altoMedido), vertical }
}

/** Disposición inicial centrada: en escalera si entran en fila, apilados si no. */
function posicionInicial(tipo: NodoRegla, { ancho, alto, vertical }: Medidas): Posicion {
  const indice = ORDEN_NODOS.indexOf(tipo)
  if (vertical) {
    return {
      x: Math.max(0, (ancho - ANCHO_NODO) / 2),
      y: MARGEN_VERTICAL + indice * (ALTO_NODO + SEPARACION_VERTICAL),
    }
  }
  const anchoTotal = ORDEN_NODOS.length * ANCHO_NODO + (ORDEN_NODOS.length - 1) * SEPARACION
  const altoTotal = ALTO_NODO + (ORDEN_NODOS.length - 1) * ESCALON
  return {
    x: Math.max(0, (ancho - anchoTotal) / 2) + indice * (ANCHO_NODO + SEPARACION),
    y: Math.max(0, (alto - altoTotal) / 2) + indice * ESCALON,
  }
}

function limitar(posicion: Posicion, { ancho, alto }: Medidas): Posicion {
  return {
    x: Math.min(Math.max(0, posicion.x), Math.max(0, ancho - ANCHO_NODO)),
    y: Math.min(Math.max(0, posicion.y), alto - ALTO_NODO),
  }
}

interface Extremos {
  salida: Posicion
  entrada: Posicion
}

/** Puntos de unión de un enlace: de lado a lado en horizontal, de abajo hacia arriba en vertical. */
function extremos(origen: Posicion, destino: Posicion, vertical: boolean): Extremos {
  return vertical
    ? {
        salida: { x: origen.x + ANCHO_NODO / 2, y: origen.y + ALTO_NODO },
        entrada: { x: destino.x + ANCHO_NODO / 2, y: destino.y },
      }
    : {
        salida: { x: origen.x + ANCHO_NODO, y: origen.y + ALTO_NODO / 2 },
        entrada: { x: destino.x, y: destino.y + ALTO_NODO / 2 },
      }
}

function trayecto({ salida, entrada }: Extremos, vertical: boolean): string {
  if (vertical) {
    const curvatura = Math.max(32, Math.abs(entrada.y - salida.y) / 2)
    return `M${salida.x},${salida.y} C${salida.x},${salida.y + curvatura} ${entrada.x},${entrada.y - curvatura} ${entrada.x},${entrada.y}`
  }
  const curvatura = Math.max(48, Math.abs(entrada.x - salida.x) / 2)
  return `M${salida.x},${salida.y} C${salida.x + curvatura},${salida.y} ${entrada.x - curvatura},${entrada.y} ${entrada.x},${entrada.y}`
}

function useTamanioCanvas() {
  const ref = useRef<HTMLDivElement>(null)
  const [tamanio, setTamanio] = useState({ ancho: ANCHO_POR_DEFECTO, alto: ALTO_HORIZONTAL })

  useLayoutEffect(() => {
    const elemento = ref.current
    if (!elemento) return
    const medir = () =>
      setTamanio({
        ancho: elemento.clientWidth || ANCHO_POR_DEFECTO,
        alto: elemento.clientHeight || ALTO_HORIZONTAL,
      })
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(elemento)
    return () => observador.disconnect()
  }, [])

  return { ref, ...tamanio }
}

interface ArrastreEnCurso {
  tipo: NodoRegla
  puntero: Posicion
  nodo: Posicion
  movido: boolean
}

/** Editor visual de la regla (DESIGN.md §9.10). Los nodos se arrastran (o se mueven con las
 * flechas del teclado) y los enlaces los siguen. La estructura es fija: el backend modela
 * exactamente un evento, una condición y una acción, así que no se agregan ni se reconectan
 * nodos. Elegir un nodo abre su diálogo de configuración. */
export function CanvasRegla({
  seleccionado,
  onSeleccionar,
  disparador,
  condicion,
  accion,
}: CanvasReglaProps) {
  const resumenes: Record<NodoRegla, ResumenNodo> = { disparador, condicion, accion }
  const { ref, ancho, alto } = useTamanioCanvas()
  const medidas = medidasDe(ancho, alto)
  // Solo se guardan los nodos que el usuario movió: el resto sigue centrado al cambiar el ancho.
  // Las posiciones valen para una disposición: al pasar de fila a columna se descartan.
  const [guardado, setGuardado] = useState<{
    vertical: boolean
    posiciones: Partial<Record<NodoRegla, Posicion>>
  }>({ vertical: medidas.vertical, posiciones: {} })
  const movidos = guardado.vertical === medidas.vertical ? guardado.posiciones : {}
  const arrastre = useRef<ArrastreEnCurso | null>(null)

  const posicion = (tipo: NodoRegla): Posicion => movidos[tipo] ?? posicionInicial(tipo, medidas)

  function mover(tipo: NodoRegla, destino: Posicion) {
    setGuardado({
      vertical: medidas.vertical,
      posiciones: { ...movidos, [tipo]: limitar(destino, medidas) },
    })
  }

  function alPresionar(evento: PointerEvent<HTMLButtonElement>, tipo: NodoRegla) {
    if (evento.button !== 0) return
    evento.currentTarget.setPointerCapture?.(evento.pointerId)
    arrastre.current = {
      tipo,
      puntero: { x: evento.clientX, y: evento.clientY },
      nodo: posicion(tipo),
      movido: false,
    }
  }

  function alMover(evento: PointerEvent<HTMLButtonElement>) {
    const actual = arrastre.current
    if (!actual) return
    const dx = evento.clientX - actual.puntero.x
    const dy = evento.clientY - actual.puntero.y
    if (!actual.movido && Math.hypot(dx, dy) < UMBRAL_ARRASTRE) return
    actual.movido = true
    mover(actual.tipo, { x: actual.nodo.x + dx, y: actual.nodo.y + dy })
  }

  function alSoltar(evento: PointerEvent<HTMLButtonElement>) {
    const actual = arrastre.current
    arrastre.current = null
    evento.currentTarget.releasePointerCapture?.(evento.pointerId)
    // Un gesto sin movimiento es un clic y abre el nodo; si se arrastró, solo lo movió.
    if (actual && !actual.movido) onSeleccionar(actual.tipo)
  }

  function alCancelar(evento: PointerEvent<HTMLButtonElement>) {
    arrastre.current = null
    evento.currentTarget.releasePointerCapture?.(evento.pointerId)
  }

  function alPulsarTecla(evento: KeyboardEvent<HTMLButtonElement>, tipo: NodoRegla) {
    const { x, y } = posicion(tipo)
    const destinos: Record<string, Posicion> = {
      ArrowLeft: { x: x - PASO_TECLADO, y },
      ArrowRight: { x: x + PASO_TECLADO, y },
      ArrowUp: { x, y: y - PASO_TECLADO },
      ArrowDown: { x, y: y + PASO_TECLADO },
    }
    const destino = destinos[evento.key]
    if (!destino) return
    evento.preventDefault()
    mover(tipo, destino)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-texto-3">
          Arrastrá los nodos para acomodarlos. Hacé clic en uno para configurarlo.
        </p>
        <Button
          variant="ghost"
          size="sm"
          disabled={Object.keys(movidos).length === 0}
          onClick={() => setGuardado({ vertical: medidas.vertical, posiciones: {} })}
        >
          <RotateCcwIcon data-icon="inline-start" />
          Acomodar
        </Button>
      </div>
      <div className="overflow-hidden rounded-panel bg-lienzo shadow-card">
        <div
          ref={ref}
          className={cn('relative', !medidas.vertical && 'h-[calc(100dvh-16rem)] min-h-80')}
          style={{
            height: medidas.vertical ? medidas.alto : undefined,
            backgroundImage: 'radial-gradient(var(--borde) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        >
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 size-full"
            fill="none"
          >
            {ENLACES.map(([origen, destino]) => {
              const puntos = extremos(posicion(origen), posicion(destino), medidas.vertical)
              return (
                <g key={destino} className={NODOS[destino].trazo}>
                  <path d={trayecto(puntos, medidas.vertical)} strokeWidth="2.5" />
                  {[puntos.salida, puntos.entrada].map((punto, indice) => (
                    <circle
                      key={indice}
                      cx={punto.x}
                      cy={punto.y}
                      r="4.5"
                      strokeWidth="2"
                      className="fill-superficie"
                    />
                  ))}
                </g>
              )
            })}
          </svg>
          {ORDEN_NODOS.map((tipo) => {
            const estilo = NODOS[tipo]
            const { x, y } = posicion(tipo)
            return (
              <button
                key={tipo}
                type="button"
                aria-pressed={seleccionado === tipo}
                onPointerDown={(evento) => alPresionar(evento, tipo)}
                onPointerMove={alMover}
                onPointerUp={alSoltar}
                onPointerCancel={alCancelar}
                onKeyDown={(evento) => alPulsarTecla(evento, tipo)}
                onClick={(evento) => {
                  // Con el puntero ya se abrió al soltar; esto cubre Enter y Espacio.
                  if (evento.detail === 0) onSeleccionar(tipo)
                }}
                style={{ left: x, top: y, width: ANCHO_NODO, height: ALTO_NODO }}
                className={cn(
                  'absolute cursor-grab touch-none rounded-[14px] px-[15px] py-[13px] text-left shadow-card select-none hover:shadow-md active:cursor-grabbing',
                  estilo.superficie,
                  seleccionado === tipo && cn('outline-2 outline-offset-[3px]', estilo.contorno),
                )}
              >
                <span
                  className={cn(
                    'mb-1.5 flex items-center gap-1.5 text-[10px] font-bold tracking-[.06em] uppercase',
                    estilo.acento,
                  )}
                >
                  <span className="flex size-5 items-center justify-center rounded-[7px] bg-superficie/60 [&>svg]:size-3">
                    {estilo.icono}
                  </span>
                  {estilo.etiqueta}
                </span>
                <span className="block truncate text-[13.5px] font-semibold text-texto">
                  {resumenes[tipo].titulo}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-texto-2">
                  {resumenes[tipo].detalle}
                </span>
                {resumenes[tipo].incompleto && (
                  <span className="absolute top-2.5 right-2.5 flex items-center gap-1 text-[10px] font-semibold text-advertencia">
                    <AlertCircleIcon className="size-3.5" aria-hidden="true" />
                    Incompleto
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
