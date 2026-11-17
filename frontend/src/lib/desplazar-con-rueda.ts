/** Dentro de un diálogo o panel lateral, su bloqueo de scroll se traga la rueda sobre un popover
 * que va en un portal: la lista no se desplaza y lo que está más abajo queda fuera de alcance. Se
 * desplaza a mano, sin pasar por el bloqueo. */
export function desplazarConRueda(lista: HTMLDivElement | null) {
  if (lista === null) return
  lista.addEventListener(
    'wheel',
    (evento) => {
      evento.preventDefault()
      evento.stopPropagation()
      lista.scrollTop += evento.deltaY * (evento.deltaMode === 1 ? 16 : 1)
    },
    { passive: false },
  )
}
