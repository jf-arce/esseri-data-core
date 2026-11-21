import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MiniFlujo } from '@/modules/workflows/components/mini-flujo'
import { nodoAccion, nodoCondicion } from '@/modules/workflows/__tests__/fabricas'

describe('MiniFlujo', () => {
  it('separa lo que sale del evento de las ramas sí / no de la condición', () => {
    render(
      <MiniFlujo
        nodos={[
          nodoAccion('a', { orden: 0, tipo_accion: 'notificar' }),
          nodoAccion('b', { orden: 1, tipo_accion: 'alerta_interna' }),
          nodoCondicion('c', { orden: 2 }),
          nodoAccion('d', { padre_id: 'c', rama: 'si', tipo_accion: 'aplicar_penalidad' }),
          nodoAccion('e', { padre_id: 'c', rama: 'no', tipo_accion: 'notificar' }),
        ]}
      />,
    )

    // Solo las dos ramas de la condición se rotulan; las acciones directas no.
    expect(screen.getAllByText(/^(sí|no)$/)).toHaveLength(2)
    expect(screen.getByText('sí')).toBeInTheDocument()
    expect(screen.getByText('no')).toBeInTheDocument()
    expect(screen.getByText('Aplicar penalidad')).toBeInTheDocument()
  })

  it('sin condición no rotula ninguna arista', () => {
    render(<MiniFlujo nodos={[nodoAccion('a'), nodoAccion('b', { orden: 1 })]} />)

    expect(screen.queryByText('sí')).not.toBeInTheDocument()
    expect(screen.queryByText('no')).not.toBeInTheDocument()
  })

  it('con un flujo grande pasa a chips compactos y no oculta nada hasta el tope', () => {
    const acciones = Array.from({ length: 7 }, (_, i) => nodoAccion(`n-${i}`, { orden: i }))
    const { container } = render(<MiniFlujo nodos={acciones} />)

    expect(container.querySelectorAll('rect')).toHaveLength(7)
    expect(container.querySelector('text')).toBeNull()
  })

  it('con más hojas que el tope compacto muestra cuántas quedaron fuera', () => {
    const acciones = Array.from({ length: 11 }, (_, i) => nodoAccion(`n-${i}`, { orden: i }))
    render(<MiniFlujo nodos={acciones} />)

    expect(screen.getByText('+3')).toBeInTheDocument()
  })
})
