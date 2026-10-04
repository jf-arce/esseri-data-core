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
    // Con el ancho por defecto (800) y 3 nodos de 210 más 2 separaciones de 56, sobran 58px en total, 29 por lado.
    expect(izquierdas).toEqual([29, 295, 561])
  })

  it('abre el nodo al soltar sin haberlo movido, y no antes', () => {
    const { onSeleccionar, nodo } = renderizar()
    const condicion = nodo(/Condición/)

    fireEvent.pointerDown(condicion, { button: 0, clientX: 300, clientY: 200 })
    expect(onSeleccionar).not.toHaveBeenCalled()
    // Un temblor menor al umbral de arrastre sigue siendo un clic.
    fireEvent.pointerMove(condicion, { clientX: 302, clientY: 201 })
    fireEvent.pointerUp(condicion, { clientX: 302, clientY: 201 })

    expect(onSeleccionar).toHaveBeenCalledTimes(1)
    expect(onSeleccionar).toHaveBeenCalledWith('condicion')
    expect(Number.parseFloat(condicion.style.left)).toBe(295)
  })

  it('cancelar el gesto no abre el nodo', () => {
    const { onSeleccionar, nodo } = renderizar()
    const condicion = nodo(/Condición/)

    fireEvent.pointerDown(condicion, { button: 0, clientX: 300, clientY: 200 })
    fireEvent.pointerCancel(condicion)

    expect(onSeleccionar).not.toHaveBeenCalled()
  })

  it('mueve el nodo con las flechas y el enlace lo sigue', async () => {
    const { nodo, trayectos } = renderizar()
    const antes = trayectos()

    nodo(/Condición/).focus()
    await userEvent.keyboard('{ArrowRight}{ArrowDown}')

    expect(Number.parseFloat(nodo(/Condición/).style.left)).toBe(307)
    expect(trayectos()).not.toEqual(antes)
  })

  it('arrastra un nodo con el puntero sin abrirlo y "Acomodar" lo devuelve', () => {
    const { onSeleccionar, nodo } = renderizar()
    const condicion = nodo(/Condición/)

    fireEvent.pointerDown(condicion, { button: 0, clientX: 300, clientY: 200 })
    fireEvent.pointerMove(condicion, { clientX: 340, clientY: 230 })
    fireEvent.pointerUp(condicion, { clientX: 340, clientY: 230 })

    expect(Number.parseFloat(condicion.style.left)).toBe(335)
    expect(onSeleccionar).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Acomodar' }))
    expect(Number.parseFloat(nodo(/Condición/).style.left)).toBe(295)
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
      expect(nodos.map((n) => Number.parseFloat(n.style.left))).toEqual([95, 95, 95])
      const arriba = nodos.map((n) => Number.parseFloat(n.style.top))
      expect(arriba[0]).toBeLessThan(arriba[1])
      expect(arriba[1]).toBeLessThan(arriba[2])
    } finally {
      if (original) Object.defineProperty(HTMLElement.prototype, 'clientWidth', original)
    }
  })

  it('marca los nodos incompletos', () => {
    render(
      <CanvasRegla
        seleccionado={null}
        onSeleccionar={vi.fn()}
        disparador={{ titulo: 'Sin evento', detalle: 'Sin nombre', incompleto: true }}
        condicion={{ titulo: 'Sin condición', detalle: 'Se ejecuta con cada evento' }}
        accion={{ titulo: 'Notificar', detalle: 'Criticidad media' }}
      />,
    )

    expect(screen.getAllByText('Incompleto')).toHaveLength(1)
    expect(screen.getByRole('button', { name: /Disparador/ })).toHaveTextContent('Incompleto')
  })
})
