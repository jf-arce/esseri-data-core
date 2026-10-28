import { afterEach, describe, expect, it, vi } from 'vitest'
import { obtenerCuentaCorriente } from '@/modules/facturacion/services/obtener-cuenta-corriente'

function respuestaOk() {
  return new Response(
    JSON.stringify({
      cuenta_corriente_id: null,
      alumno_id: 'alumno-1',
      total_debe: '0.00',
      total_haber: '0.00',
      saldo: '0.00',
      movimientos: [],
      total_movimientos: 0,
      pagina: 1,
      tamanio: 20,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

describe('obtenerCuentaCorriente', () => {
  afterEach(() => vi.restoreAllMocks())

  it('consulta la cuenta corriente del alumno autenticado por permisos', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respuestaOk())

    await obtenerCuentaCorriente('alumno con espacio')

    expect(fetchMock.mock.calls[0][0]).toContain(
      '/facturacion/alumnos/alumno%20con%20espacio/cuenta-corriente',
    )
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'include' })
  })
})
