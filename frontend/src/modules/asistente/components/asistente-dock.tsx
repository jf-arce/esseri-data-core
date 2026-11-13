import { useRef } from 'react'
import { useAuthStore } from '@/store/auth-store'
import { ANCHO_MAXIMO_PANEL, ANCHO_MINIMO_PANEL, PASO_TECLADO_ANCHO } from '../constants'
import { useAsistenteStore } from '../store'
import { AsistentePanel } from './asistente-panel'

/**
 * Panel acoplado a la derecha, dentro del layout: angosta el contenido en vez de taparlo. En
 * pantallas angostas ocupa todo el ancho. El ancho se cambia arrastrando el borde izquierdo
 * (o con las flechas, con el borde enfocado). Cerrado queda montado pero oculto, para conservar la
 * conversación en curso.
 */
export function AsistenteDock({ abierto }: { abierto: boolean }) {
  const ancho = useAsistenteStore((estado) => estado.ancho)
  const setAncho = useAsistenteStore((estado) => estado.setAncho)
  const usuarioId = useAuthStore((estado) => estado.usuario?.id ?? null)
  const rolActivo = useAuthStore((estado) => estado.rolActivo)
  const arrastre = useRef<{ x: number; ancho: number } | null>(null)

  function alPresionar(evento: React.PointerEvent<HTMLDivElement>) {
    evento.preventDefault()
    evento.currentTarget.setPointerCapture(evento.pointerId)
    arrastre.current = { x: evento.clientX, ancho }
  }

  function alMover(evento: React.PointerEvent<HTMLDivElement>) {
    if (arrastre.current === null) return
    // El panel está a la derecha: arrastrar hacia la izquierda lo agranda.
    setAncho(arrastre.current.ancho + (arrastre.current.x - evento.clientX))
  }

  function alSoltar(evento: React.PointerEvent<HTMLDivElement>) {
    arrastre.current = null
    if (evento.currentTarget.hasPointerCapture(evento.pointerId)) {
      evento.currentTarget.releasePointerCapture(evento.pointerId)
    }
  }

  function alTeclear(evento: React.KeyboardEvent) {
    if (evento.key === 'ArrowLeft') setAncho(ancho + PASO_TECLADO_ANCHO)
    else if (evento.key === 'ArrowRight') setAncho(ancho - PASO_TECLADO_ANCHO)
    else return
    evento.preventDefault()
  }

  return (
    <aside
      aria-label="Asistente"
      style={{ '--ancho-asistente': `${ancho}px` } as React.CSSProperties}
      hidden={!abierto}
      className="fixed inset-0 z-40 bg-superficie md:sticky md:inset-auto md:top-0 md:z-auto md:h-svh md:w-(--ancho-asistente) md:shrink-0 md:border-l md:border-borde"
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Cambiar el ancho del asistente"
        aria-valuemin={ANCHO_MINIMO_PANEL}
        aria-valuemax={ANCHO_MAXIMO_PANEL}
        aria-valuenow={ancho}
        tabIndex={0}
        onPointerDown={alPresionar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        onKeyDown={alTeclear}
        className="absolute inset-y-0 -left-1 z-10 hidden w-2 cursor-col-resize hover:bg-violeta/20 focus-visible:bg-violeta/30 focus-visible:outline-none md:block"
      />
      {/* La `key` descarta todo el estado al cambiar de cuenta o de rol. */}
      <AsistentePanel key={`${usuarioId}:${rolActivo}`} />
    </aside>
  )
}
