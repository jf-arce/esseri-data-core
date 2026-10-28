import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/** Abre el menú "···" de una fila (por defecto la primera). */
export async function abrirMenuDeFila(nombreFila: string | RegExp = '', indice = 0) {
  const nombre =
    typeof nombreFila === 'string' ? new RegExp(`Acciones para ${nombreFila}`) : nombreFila
  const disparadores = await screen.findAllByRole('button', { name: nombre })
  await userEvent.click(disparadores[indice])
}

/** Abre el menú de la fila y elige una opción. */
export async function elegirAccion(
  opcion: string | RegExp,
  nombreFila: string | RegExp = '',
  indice = 0,
) {
  await abrirMenuDeFila(nombreFila, indice)
  await userEvent.click(await screen.findByRole('menuitem', { name: opcion }))
}
