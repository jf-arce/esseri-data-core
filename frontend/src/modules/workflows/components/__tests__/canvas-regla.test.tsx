import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CanvasRegla } from '@/modules/workflows/components/canvas-regla'

function renderizar(onSeleccionar = vi.fn()) {
  const resultado = render(
    <CanvasRegla
      seleccionado="disparador"
      onSeleccionar={onSeleccionar}
      disparador={{ titulo: 'Vence una factura', detalle: 'Aviso de mora' }}
      condicion={{ titulo: 'Sin condición', detalle: 'Se ejecuta con cada evento' }}
      accion={{ titulo: 'Notificar', detalle: 'Criticidad media' }}
    />,
  )
  const nodo = (nombre: RegExp) => screen.getByRole('button', { name: nombre })
  const trayectos = () =>
    Array.from(resultado.container.querySelectorAll('path')).map((path) => path.getAttribute('d'))
  return { onSeleccionar, nodo, trayectos }
}

describe('CanvasRegla', () => {
  it('selecciona un nodo con un clic', async () => {
    const { onSeleccionar, nodo } = renderizar()

    await userEvent.click(nodo(/Acción/))

    expect(onSeleccionar).toHaveBeenCalledWith('accion')
  })

  it('centra los tres nodos en el canvas al abrir', () => {
    const { nodo } = renderizar()

    const izquierdas = [/Disparador/, /Condición/, /Acción/].map((n) =>
      Number.parseFloat(nodo(n).style.left),
    )
    // Con el ancho mínimo (720) y 3 nodos de 190 más 2 separaciones de 56, sobran 38px en total, 19 por lado.
    expect(izquierdas).toEqual([19, 265, 511])
  })

  it('mueve el nodo con las flechas y el enlace lo sigue', async () => {
    const { nodo, trayectos } = renderizar()
    const antes = trayectos()

    nodo(/Condición/).focus()
    await userEvent.keyboard('{ArrowRight}{ArrowDown}')

    expect(Number.parseFloat(nodo(/Condición/).style.left)).toBe(277)
    expect(trayectos()).not.toEqual(antes)
  })

  it('arrastra un nodo con el puntero, lo selecciona y "Acomodar" lo devuelve', () => {
    const { onSeleccionar, nodo } = renderizar()
    const condicion = nodo(/Condición/)

    fireEvent.pointerDown(condicion, { button: 0, clientX: 300, clientY: 200 })
    fireEvent.pointerMove(condicion, { clientX: 340, clientY: 230 })
    fireEvent.pointerUp(condicion, { clientX: 340, clientY: 230 })

    expect(Number.parseFloat(condicion.style.left)).toBe(305)
    expect(onSeleccionar).toHaveBeenCalledTimes(1)
    expect(onSeleccionar).toHaveBeenCalledWith('condicion')

    fireEvent.click(screen.getByRole('button', { name: 'Acomodar' }))
    expect(Number.parseFloat(nodo(/Condición/).style.left)).toBe(265)
  })

  it('apila y centra los nodos cuando el canvas es angosto', () => {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 400,
    })
    try {
      const { nodo } = renderizar()

      const nodos = [/Disparador/, /Condición/, /Acción/].map((n) => nodo(n))
      expect(nodos.map((n) => Number.parseFloat(n.style.left))).toEqual([105, 105, 105])
      const arriba = nodos.map((n) => Number.parseFloat(n.style.top))
      expect(arriba[0]).toBeLessThan(arriba[1])
      expect(arriba[1]).toBeLessThan(arriba[2])
    } finally {
      if (original) Object.defineProperty(HTMLElement.prototype, 'clientWidth', original)
    }
  })
})
