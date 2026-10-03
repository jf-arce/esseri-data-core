import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import { PlantillaSheet } from '@/modules/workflows/components/plantilla-sheet'
import { actualizarPlantilla } from '@/modules/workflows/services/actualizar-plantilla'
import { crearPlantilla } from '@/modules/workflows/services/crear-plantilla'
import type { PlantillaNotificacion, TipoEvento } from '@/modules/workflows/types'

vi.mock('@/modules/workflows/services/actualizar-plantilla')
vi.mock('@/modules/workflows/services/crear-plantilla')

const evento: TipoEvento = {
  id: 'e-1',
  nombre: 'factura.vencida',
  descripcion: null,
  campos: [
    { id: 'c-1', nombre_interno: 'dias_vencido', etiqueta: 'Días vencido', tipo_dato: 'numero' },
    { id: 'c-2', nombre_interno: 'monto_deuda', etiqueta: 'Monto adeudado', tipo_dato: 'numero' },
  ],
}

const guardada: PlantillaNotificacion = {
  id: 'pl-1',
  nombre: 'Aviso',
  asunto: 'Asunto',
  cuerpo: 'Cuerpo',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
}

function abrir(plantilla: PlantillaNotificacion | null = null, onGuardada = vi.fn()) {
  render(
    <PlantillaSheet
      abierto
      plantilla={plantilla}
      evento={evento}
      onCerrar={vi.fn()}
      onGuardada={onGuardada}
    />,
  )
  return onGuardada
}

describe('PlantillaSheet', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('inserta el chip en el cuerpo, que es el campo por defecto', async () => {
    const user = userEvent.setup()
    abrir()

    await user.type(screen.getByRole('textbox', { name: 'Cuerpo' }), 'Debés ')
    await user.click(screen.getByRole('button', { name: 'Monto adeudado' }))

    expect(screen.getByRole('textbox', { name: 'Cuerpo' })).toHaveValue('Debés {{monto_deuda}}')
  })

  it('inserta el chip en el último campo enfocado y en la posición del cursor', async () => {
    const user = userEvent.setup()
    abrir()

    await user.type(screen.getByRole('textbox', { name: 'Cuerpo' }), 'Hola')
    await user.type(screen.getByRole('textbox', { name: 'Asunto' }), 'Deuda ')
    await user.click(screen.getByRole('button', { name: 'Días vencido' }))

    expect(screen.getByRole('textbox', { name: 'Asunto' })).toHaveValue('Deuda {{dias_vencido}}')
    expect(screen.getByRole('textbox', { name: 'Cuerpo' })).toHaveValue('Hola')
  })

  it('avisa si un placeholder no existe en el evento o tiene mal el formato', async () => {
    const user = userEvent.setup()
    abrir()

    await user.type(screen.getByRole('textbox', { name: 'Asunto' }), 'Hola {{{{inventado}}')
    expect(screen.getByText(/no existen en el evento: inventado/)).toBeInTheDocument()

    await user.clear(screen.getByRole('textbox', { name: 'Asunto' }))
    await user.type(screen.getByRole('textbox', { name: 'Cuerpo' }), '{{{{ monto }}')
    expect(screen.getByText(/formato exacto/)).toBeInTheDocument()
  })

  it('no deja guardar con campos vacíos', () => {
    abrir()

    expect(screen.getByRole('button', { name: 'Crear plantilla' })).toBeDisabled()
  })

  it('crea la plantilla y avisa con la respuesta del backend', async () => {
    const user = userEvent.setup()
    vi.mocked(crearPlantilla).mockResolvedValue(guardada)
    const onGuardada = abrir()

    await user.type(screen.getByRole('textbox', { name: 'Nombre' }), ' Aviso ')
    await user.type(screen.getByRole('textbox', { name: 'Asunto' }), 'Asunto')
    await user.type(screen.getByRole('textbox', { name: 'Cuerpo' }), 'Cuerpo')
    await user.click(screen.getByRole('button', { name: 'Crear plantilla' }))

    await waitFor(() => expect(onGuardada).toHaveBeenCalledWith(guardada))
    expect(crearPlantilla).toHaveBeenCalledWith({
      nombre: 'Aviso',
      asunto: 'Asunto',
      cuerpo: 'Cuerpo',
    })
  })

  it('al editar avisa que afecta a todas las reglas y manda un PATCH', async () => {
    const user = userEvent.setup()
    vi.mocked(actualizarPlantilla).mockResolvedValue(guardada)
    const onGuardada = abrir(guardada)

    expect(screen.getByText(/afecta a todas las reglas/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(onGuardada).toHaveBeenCalled())
    expect(actualizarPlantilla).toHaveBeenCalledWith('pl-1', {
      nombre: 'Aviso',
      asunto: 'Asunto',
      cuerpo: 'Cuerpo',
    })
  })

  it.each([
    [409, 'Ya existe una plantilla con ese nombre.'],
    [422, "La plantilla de la regla 'Mora' usa el campo 'x' que el evento no tiene."],
  ])('muestra el detalle del backend ante un %s sin cerrar', async (status, detalle) => {
    const user = userEvent.setup()
    vi.mocked(actualizarPlantilla).mockRejectedValue(new ApiError(status, detalle))
    const onGuardada = abrir(guardada)

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText(detalle)).toBeInTheDocument()
    expect(onGuardada).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled()
  })
})
