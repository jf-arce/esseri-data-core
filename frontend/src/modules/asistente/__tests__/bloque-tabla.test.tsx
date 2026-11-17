import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { expect, it } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { BloqueTablaVista } from '../components/bloque-tabla'
import { ALTO_FILA_TABLA, FILAS_VISIBLES_TABLA } from '../constants'
import type { BloqueTabla } from '../types'

function tabla(cantidad: number): BloqueTabla {
  return {
    tipo: 'tabla',
    tabla_id: 't1',
    titulo: 'Filas',
    columnas: [{ clave: 'n', etiqueta: 'N', tipo: 'numero' }],
    filas: Array.from({ length: cantidad }, (_, indice) => ({ n: indice })),
    periodo: '2026',
    fuente: 'Panel',
  }
}

const conProveedor = (arbol: ReactElement) => <TooltipProvider>{arbol}</TooltipProvider>
const contenedor = () => document.querySelector<HTMLElement>('[data-slot="table-container"]')

it('con pocas filas no scrollea ni limita el alto', () => {
  render(conProveedor(<BloqueTablaVista bloque={tabla(FILAS_VISIBLES_TABLA)} porAlias={{}} />))
  expect(contenedor()?.style.maxHeight).toBe('')
  expect(screen.queryByText(/deslizá/)).not.toBeInTheDocument()
})

it('con más filas que las visibles limita el alto y avisa que hay más', () => {
  render(conProveedor(<BloqueTablaVista bloque={tabla(FILAS_VISIBLES_TABLA + 5)} porAlias={{}} />))
  expect(contenedor()?.style.maxHeight).toBe(`${(FILAS_VISIBLES_TABLA + 1) * ALTO_FILA_TABLA}px`)
  expect(contenedor()).toHaveClass('overflow-y-auto')
  expect(
    screen.getByText(new RegExp(`${FILAS_VISIBLES_TABLA + 5} filas, deslizá para ver el resto`)),
  ).toBeVisible()
})

it('copia solo el encabezado y las filas, sin título ni fuente', async () => {
  const usuario = userEvent.setup()
  render(conProveedor(<BloqueTablaVista bloque={tabla(3)} porAlias={{}} />))

  await usuario.click(screen.getByRole('button', { name: 'Copiar la tabla' }))

  await waitFor(async () => expect(await navigator.clipboard.readText()).toBe('N\n0\n1\n2'))
  expect(screen.getByRole('button', { name: 'Tabla copiada' })).toBeVisible()
})

it('ofrece primero Excel y después CSV', async () => {
  const usuario = userEvent.setup()
  render(conProveedor(<BloqueTablaVista bloque={tabla(3)} porAlias={{}} conversacionId="c1" />))

  await usuario.click(screen.getByRole('button', { name: 'Descargar la tabla' }))

  const opciones = await screen.findAllByRole('menuitem')
  expect(opciones.map((o) => o.textContent)).toEqual(['Descargar Excel', 'Descargar CSV'])
})

it('sin conversación guardada se puede copiar pero no descargar', () => {
  render(conProveedor(<BloqueTablaVista bloque={tabla(3)} porAlias={{}} />))
  expect(screen.getByRole('button', { name: 'Copiar la tabla' })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Descargar la tabla' })).not.toBeInTheDocument()
})
