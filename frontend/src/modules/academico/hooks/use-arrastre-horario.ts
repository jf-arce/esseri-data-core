import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from 'react'
import { toast } from 'sonner'
import type { FranjaConMateria } from '@/modules/academico/types'
import {
  aMinutos,
  deMinutos,
  desplazamientoEnMinutos,
  estirarFranja,
  franjaChoca,
  mensajeChoque,
  minutosEnPosicion,
  moverFranja,
  type FranjaHoraria,
  type RangoGrilla,
} from '@/modules/academico/utils'

export type VistaPrevia = {
  modo: 'mover' | 'estirar' | 'crear'
  /** Franja que se está tocando; falta al crear. */
  franja?: FranjaConMateria
  destino: FranjaHoraria
  choca: boolean
}

const PULSACION_LARGA_MS = 400
const TOLERANCIA_TACTIL_PX = 8
const UMBRAL_MOUSE_PX = 4
const BORDE_AUTOSCROLL_PX = 40
const VELOCIDAD_AUTOSCROLL_PX = 12

type Geometria = {
  top: number
  alto: number
  columnas: { dia: number; izquierda: number; derecha: number }[]
  rango: Pick<RangoGrilla, 'inicio' | 'fin'>
}

type Gesto = {
  /** Devuelve la vista previa para la posición del puntero, o `null` si no hay cambio. */
  calcular: (x: number, y: number, geometria: Geometria) => VistaPrevia | null
  /** `vista` es `null` si el puntero no llegó a arrastrar (fue un clic). */
  alSoltar: (vista: VistaPrevia | null) => void
  /** En `crear` el clic simple también cuenta, así que se avisa aunque no haya arrastre. */
  esClicValido: boolean
  autoscroll?: boolean
}

interface Opciones {
  rango: Pick<RangoGrilla, 'inicio' | 'fin'>
  capas: RefObject<Map<number, HTMLElement>>
  /** Contenedor con scroll horizontal: se desplaza solo al arrastrar cerca de sus bordes. */
  contenedor: RefObject<HTMLElement | null>
  franjas: FranjaConMateria[]
  /** Avisa cuando empieza (`true`) y termina (`false`) un gesto, para congelar la grilla. */
  onActivo: (activo: boolean) => void
  onMover: (franja: FranjaConMateria, destino: FranjaHoraria) => void
  onCrear: (hueco: FranjaHoraria) => void
}

/**
 * Gestos de mouse y táctiles sobre la grilla: mover un bloque, estirarlo y crear uno barriendo
 * huecos. Con el dedo, el gesto arranca con una pulsación larga; antes de eso el movimiento es
 * el scroll normal del contenedor. La geometría se mide una vez al empezar.
 */
export function useArrastreHorario({
  rango,
  capas,
  contenedor,
  franjas,
  onActivo,
  onMover,
  onCrear,
}: Opciones) {
  const [vistaPrevia, setVistaPrevia] = useState<VistaPrevia | null>(null)
  const limpiarRef = useRef<(() => void) | null>(null)
  const finDeArrastreRef = useRef(false)
  const tactilRef = useRef(false)
  // Los callbacks se leen al soltar, no al empezar: la grilla pudo recargarse en el medio.
  const opcionesRef = useRef({ franjas, onMover, onCrear, onActivo })
  useEffect(() => {
    opcionesRef.current = { franjas, onMover, onCrear, onActivo }
  })

  useEffect(() => () => limpiarRef.current?.(), [])

  function medir(): Geometria | null {
    const columnas = [...capas.current.entries()]
      .map(([dia, elemento]) => {
        const rect = elemento.getBoundingClientRect()
        return { dia, izquierda: rect.left, derecha: rect.right, top: rect.top, alto: rect.height }
      })
      .sort((a, b) => a.izquierda - b.izquierda)
    if (columnas.length === 0) return null
    return {
      top: columnas[0].top,
      alto: columnas[0].alto,
      columnas: columnas.map(({ dia, izquierda, derecha }) => ({ dia, izquierda, derecha })),
      rango: { inicio: rango.inicio, fin: rango.fin },
    }
  }

  function empezar(evento: PointerEvent<HTMLElement>, gesto: Gesto) {
    if (evento.pointerType === 'mouse' && evento.button !== 0) return
    if (limpiarRef.current) return
    const geometria = medir()
    if (!geometria) return

    const tactil = evento.pointerType !== 'mouse'
    tactilRef.current = tactil
    const { pointerId, clientX: x0, clientY: y0 } = evento
    let habilitado = !tactil
    let arrastrando = false
    let vista: VistaPrevia | null = null
    let temporizador: ReturnType<typeof setTimeout> | undefined
    let cuadro: number | undefined
    const scrollInicial = contenedor.current?.scrollLeft ?? 0
    const ultimo = { x: x0, y: y0 }

    // La geometría se midió al empezar: si el contenedor se desplazó, se corrige la posición.
    function recalcular() {
      const desplazado = (contenedor.current?.scrollLeft ?? 0) - scrollInicial
      vista = gesto.calcular(ultimo.x + desplazado, ultimo.y, geometria!)
      setVistaPrevia(vista)
    }

    function desplazar() {
      const elemento = contenedor.current
      if (elemento) {
        const rect = elemento.getBoundingClientRect()
        const antes = elemento.scrollLeft
        if (ultimo.x < rect.left + BORDE_AUTOSCROLL_PX)
          elemento.scrollLeft -= VELOCIDAD_AUTOSCROLL_PX
        else if (ultimo.x > rect.right - BORDE_AUTOSCROLL_PX)
          elemento.scrollLeft += VELOCIDAD_AUTOSCROLL_PX
        if (elemento.scrollLeft !== antes) recalcular()
      }
      cuadro = requestAnimationFrame(desplazar)
    }

    function habilitar() {
      habilitado = true
      opcionesRef.current.onActivo(true)
      if (tactil) navigator.vibrate?.(10)
    }

    function terminar() {
      clearTimeout(temporizador)
      if (cuadro !== undefined) cancelAnimationFrame(cuadro)
      window.removeEventListener('pointermove', alMover)
      window.removeEventListener('pointerup', alSoltar)
      window.removeEventListener('pointercancel', alCancelar)
      window.removeEventListener('keydown', alTeclear)
      window.removeEventListener('touchmove', alMoverTactil)
      limpiarRef.current = null
      opcionesRef.current.onActivo(false)
      setVistaPrevia(null)
    }

    function alMover(e: globalThis.PointerEvent) {
      if (e.pointerId !== pointerId) return
      const distancia = Math.hypot(e.clientX - x0, e.clientY - y0)
      if (!habilitado) {
        // Todavía no pasó la pulsación larga: el dedo que se mueve está haciendo scroll.
        if (distancia > TOLERANCIA_TACTIL_PX) terminar()
        return
      }
      if (!arrastrando && distancia < UMBRAL_MOUSE_PX) return
      if (!arrastrando && gesto.autoscroll) cuadro = requestAnimationFrame(desplazar)
      arrastrando = true
      ultimo.x = e.clientX
      ultimo.y = e.clientY
      recalcular()
    }

    function alSoltar(e: globalThis.PointerEvent) {
      if (e.pointerId !== pointerId) return
      const seArrastro = arrastrando
      const resultado = seArrastro ? vista : null
      terminar()
      if (seArrastro) {
        finDeArrastreRef.current = true
        setTimeout(() => (finDeArrastreRef.current = false), 0)
      }
      if (seArrastro || gesto.esClicValido) gesto.alSoltar(resultado)
    }

    function alCancelar(e: globalThis.PointerEvent) {
      if (e.pointerId === pointerId) terminar()
    }

    function alTeclear(e: KeyboardEvent) {
      if (e.key === 'Escape') terminar()
    }

    function alMoverTactil(e: TouchEvent) {
      if (habilitado && e.cancelable) e.preventDefault()
    }

    window.addEventListener('pointermove', alMover)
    window.addEventListener('pointerup', alSoltar)
    window.addEventListener('pointercancel', alCancelar)
    window.addEventListener('keydown', alTeclear)
    window.addEventListener('touchmove', alMoverTactil, { passive: false })
    limpiarRef.current = terminar

    if (tactil) temporizador = setTimeout(habilitar, PULSACION_LARGA_MS)
    else habilitar()
  }

  function diaEn(x: number, geometria: Geometria): number {
    const { columnas } = geometria
    const columna =
      columnas.find((c) => x >= c.izquierda && x < c.derecha) ??
      (x < columnas[0].izquierda ? columnas[0] : columnas[columnas.length - 1])
    return columna.dia
  }

  function iniciarCambio(
    evento: PointerEvent<HTMLElement>,
    franja: FranjaConMateria,
    modo: 'mover' | 'estirar',
    destinoEn: (x: number, desplazamiento: number, geometria: Geometria) => FranjaHoraria,
  ) {
    const y0 = evento.clientY
    empezar(evento, {
      esClicValido: false,
      autoscroll: modo === 'mover',
      calcular: (x, y, geometria) => {
        const desplazamiento = desplazamientoEnMinutos(y - y0, geometria.alto, geometria.rango)
        const destino = destinoEn(x, desplazamiento, geometria)
        return {
          modo,
          franja,
          destino,
          choca: franjaChoca(opcionesRef.current.franjas, destino, franja.id),
        }
      },
      alSoltar: (vista) => {
        if (!vista) return
        if (vista.choca) {
          toast.error(mensajeChoque(opcionesRef.current.franjas, vista.destino, franja.id))
          return
        }
        if (!igualesFranjas(vista.destino, franja))
          opcionesRef.current.onMover(franja, vista.destino)
      },
    })
  }

  function iniciarMover(evento: PointerEvent<HTMLElement>, franja: FranjaConMateria) {
    iniciarCambio(evento, franja, 'mover', (x, desplazamiento, g) =>
      moverFranja(franja, desplazamiento, diaEn(x, g), g.rango),
    )
  }

  function iniciarEstirar(evento: PointerEvent<HTMLElement>, franja: FranjaConMateria) {
    iniciarCambio(evento, franja, 'estirar', (_x, desplazamiento, g) =>
      estirarFranja(franja, desplazamiento, g.rango),
    )
  }

  function iniciarCrear(evento: PointerEvent<HTMLElement>, dia: number) {
    const geometria = medir()
    if (!geometria) return
    const inicio = minutosEnPosicion(
      evento.clientY - geometria.top,
      geometria.alto,
      geometria.rango,
    )
    empezar(evento, {
      esClicValido: true,
      calcular: (_x, y, g) => {
        const actual = minutosEnPosicion(y - g.top, g.alto, g.rango)
        const destino = {
          dia_semana: dia,
          hora_inicio: deMinutos(Math.min(inicio, actual)),
          hora_fin: deMinutos(Math.max(inicio, actual) + 30),
        }
        return {
          modo: 'crear',
          destino,
          choca: franjaChoca(opcionesRef.current.franjas, destino),
        }
      },
      alSoltar: (vista) => {
        const barrido =
          vista && aMinutos(vista.destino.hora_fin) - aMinutos(vista.destino.hora_inicio) > 30
        if (!vista || !barrido) {
          opcionesRef.current.onCrear({
            dia_semana: dia,
            hora_inicio: deMinutos(inicio),
            hora_fin: deMinutos(inicio + 60),
          })
          return
        }
        if (vista.choca) {
          toast.error(mensajeChoque(opcionesRef.current.franjas, vista.destino))
          return
        }
        opcionesRef.current.onCrear(vista.destino)
      },
    })
  }

  return {
    vistaPrevia,
    iniciarMover,
    iniciarEstirar,
    iniciarCrear,
    esFinDeArrastre: () => finDeArrastreRef.current,
    /** Evita el menú contextual que abre la pulsación larga en el celular. */
    alMenuContextual: (evento: MouseEvent<HTMLElement>) => {
      if (tactilRef.current) evento.preventDefault()
    },
  }
}

function igualesFranjas(a: FranjaHoraria, b: FranjaHoraria): boolean {
  return (
    a.dia_semana === b.dia_semana &&
    a.hora_inicio.slice(0, 5) === b.hora_inicio.slice(0, 5) &&
    a.hora_fin.slice(0, 5) === b.hora_fin.slice(0, 5)
  )
}
