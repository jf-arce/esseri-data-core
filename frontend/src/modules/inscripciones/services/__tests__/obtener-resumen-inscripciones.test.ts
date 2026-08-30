import { afterEach, describe, expect, it, vi } from 'vitest'
import { obtenerResumenInscripciones } from '@/modules/inscripciones/services/obtener-resumen-inscripciones'

describe('obtenerResumenInscripciones', () => {
  afterEach(() => vi.restoreAllMocks())

  it('consulta el resumen del ciclo activo', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await obtenerResumenInscripciones('2027')

    expect(fetchMock.mock.calls[0][0]).toContain('/inscripciones/resumen?ciclo_lectivo=2027')
  })
})
